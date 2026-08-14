import type { PhotoIntakeConfig } from "./config";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";

type InventoryMatch = {
  id: string;
  fields: Record<string, unknown>;
};

type GraphListResponse<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
};

async function getGraphToken(config: PhotoIntakeConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }
  );
  if (!response.ok) throw new Error(`Graph authentication failed (${response.status}).`);
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("Graph authentication returned no access token.");
  return payload.access_token;
}

async function graphRequest(
  config: PhotoIntakeConfig,
  pathOrUrl: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getGraphToken(config);
  const url = pathOrUrl.startsWith("https://") ? pathOrUrl : `${GRAPH_ROOT}${pathOrUrl}`;
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

async function graphJson<T>(
  config: PhotoIntakeConfig,
  pathOrUrl: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await graphRequest(config, pathOrUrl, init);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Microsoft Graph request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return (await response.json()) as T;
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

export async function findInventoryBySku(
  config: PhotoIntakeConfig,
  sku: string
): Promise<InventoryMatch | null> {
  const select = "SKU,Title,WebsiteTitle";
  const query = new URLSearchParams({
    "$expand": `fields($select=${select})`,
    "$filter": `fields/SKU eq '${escapeOData(sku)}'`,
    "$top": "2",
  });
  const path = `/sites/${config.siteId}/lists/${config.inventoryListId}/items?${query.toString()}`;
  const response = await graphRequest(config, path, {
    headers: { Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly" },
  });
  if (response.ok) {
    const data = (await response.json()) as GraphListResponse<InventoryMatch>;
    return data.value?.[0] ?? null;
  }

  // Some tenants reject filtering on an unindexed custom field. Fall back to a
  // bounded page walk and compare exact SKU values rather than accepting a title match.
  let next: string | undefined =
    `${GRAPH_ROOT}/sites/${config.siteId}/lists/${config.inventoryListId}/items` +
    `?$expand=fields($select=${select})&$top=200`;
  let pages = 0;
  while (next && pages < 10) {
    const page: GraphListResponse<InventoryMatch> =
      await graphJson<GraphListResponse<InventoryMatch>>(config, next);
    const match = page.value?.find((item) => String(item.fields.SKU ?? "").toUpperCase() === sku);
    if (match) return match;
    next = page["@odata.nextLink"];
    pages += 1;
  }
  return null;
}

async function getDriveItemByPath(config: PhotoIntakeConfig, path: string) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await graphRequest(
    config,
    `/drives/${config.productPhotosDriveId}/root:/${encodedPath}`
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Unable to inspect SharePoint folder (${response.status}).`);
  return (await response.json()) as { id: string; webUrl?: string };
}

export async function ensureDriveFolder(
  config: PhotoIntakeConfig,
  path: string
): Promise<{ id: string; webUrl?: string }> {
  const segments = path.split("/").filter(Boolean);
  let currentPath = "";
  let parentId = "root";
  let current: { id: string; webUrl?: string } = { id: "root" };

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existing = await getDriveItemByPath(config, currentPath);
    if (existing) {
      current = existing;
      parentId = existing.id;
      continue;
    }
    current = await graphJson<{ id: string; webUrl?: string }>(
      config,
      `/drives/${config.productPhotosDriveId}/items/${parentId}/children`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: segment, folder: {}, "@microsoft.graph.conflictBehavior": "fail" }),
      }
    );
    parentId = current.id;
  }
  return current;
}

export async function uploadDriveFile(
  config: PhotoIntakeConfig,
  folderPath: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string
): Promise<{ id: string; webUrl: string }> {
  await ensureDriveFolder(config, folderPath);
  const encodedPath = `${folderPath}/${fileName}`.split("/").map(encodeURIComponent).join("/");
  const response = await graphRequest(
    config,
    `/drives/${config.productPhotosDriveId}/root:/${encodedPath}:/content`,
    { method: "PUT", headers: { "content-type": contentType }, body: Buffer.from(bytes) }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SharePoint upload failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as { id: string; webUrl: string };
}

export async function updateInventoryPhotoFields(
  config: PhotoIntakeConfig,
  inventoryItemId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const response = await graphRequest(
    config,
    `/sites/${config.siteId}/lists/${config.inventoryListId}/items/${inventoryItemId}/fields`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    }
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Inventory photo update failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}
