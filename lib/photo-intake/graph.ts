import { randomUUID } from "node:crypto";
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

type GraphColumn = {
  name: string;
  displayName: string;
  hidden?: boolean;
};

type DriveImage = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
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

function generatedSku(now = new Date()): string {
  const date = now.toISOString().slice(2, 10).replaceAll("-", "");
  return `RT-${date}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function createInventoryDraft(
  config: PhotoIntakeConfig,
  input: {
    title: string;
    purchaseCost?: number;
    dateAcquired: string;
    sourceStore?: string;
    location?: string;
  }
): Promise<InventoryMatch & { sku: string }> {
  const columns = await graphJson<GraphListResponse<GraphColumn>>(
    config,
    `/sites/${config.siteId}/lists/${config.inventoryListId}/columns?$select=name,displayName,hidden`
  );
  const visible = columns.value?.filter((column) => !column.hidden) ?? [];
  const fieldName = (displayName: string) =>
    visible.find((column) => column.displayName.toLowerCase() === displayName.toLowerCase())?.name;
  const setIfPresent = (fields: Record<string, unknown>, displayName: string, value: unknown) => {
    const name = fieldName(displayName);
    if (name && value !== undefined && value !== "") fields[name] = value;
  };

  const sku = generatedSku();
  const fields: Record<string, unknown> = {
    [fieldName("Title") ?? "Title"]: input.title,
    [fieldName("SKU") ?? "SKU"]: sku,
    [fieldName("Status") ?? "Status"]: "Needs Research",
  };
  setIfPresent(fields, "Purchase Cost", input.purchaseCost);
  setIfPresent(fields, "Date Acquired", input.dateAcquired);
  setIfPresent(fields, "Source", input.sourceStore);
  setIfPresent(fields, "Location", input.location);
  const intakeNotes = [
    input.location ? `Stored in ${input.location}.` : "",
    input.sourceStore ? `Sourced from ${input.sourceStore}.` : "",
    "Verify identity, photograph labels and research sold comps.",
  ].filter(Boolean).join(" ");
  setIfPresent(fields, "Next Action", intakeNotes);

  const created = await graphJson<InventoryMatch>(
    config,
    `/sites/${config.siteId}/lists/${config.inventoryListId}/items`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields }),
    }
  );
  return { ...created, sku };
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

async function inventoryColumns(config: PhotoIntakeConfig): Promise<GraphColumn[]> {
  const columns = await graphJson<GraphListResponse<GraphColumn>>(
    config,
    `/sites/${config.siteId}/lists/${config.inventoryListId}/columns?$select=name,displayName,hidden`
  );
  return columns.value?.filter((column) => !column.hidden) ?? [];
}

export async function updateInventoryDisplayFields(
  config: PhotoIntakeConfig,
  inventoryItemId: string,
  displayFields: Record<string, unknown>
): Promise<void> {
  const columns = await inventoryColumns(config);
  const fields: Record<string, unknown> = {};
  for (const [displayName, value] of Object.entries(displayFields)) {
    const column = columns.find(
      (candidate) => candidate.displayName.toLowerCase() === displayName.toLowerCase()
    );
    if (column && value !== undefined) fields[column.name] = value;
  }
  if (!Object.keys(fields).length) return;
  await updateInventoryPhotoFields(config, inventoryItemId, fields);
}

export async function getInventoryItem(
  config: PhotoIntakeConfig,
  inventoryItemId: string
): Promise<InventoryMatch> {
  return graphJson<InventoryMatch>(
    config,
    `/sites/${config.siteId}/lists/${config.inventoryListId}/items/${inventoryItemId}?$expand=fields`
  );
}

export async function listDriveFolderImages(
  config: PhotoIntakeConfig,
  folderPath: string,
  limit = 12
): Promise<DriveImage[]> {
  const folder = await getDriveItemByPath(config, folderPath);
  if (!folder) return [];
  const children = await graphJson<GraphListResponse<{
    id: string;
    name: string;
    file?: { mimeType?: string };
  }>>(
    config,
    `/drives/${config.productPhotosDriveId}/items/${folder.id}/children?$select=id,name,file&$top=${limit}`
  );
  const files = (children.value ?? []).filter((item) => item.file).slice(0, limit);
  const images: DriveImage[] = [];
  for (const file of files) {
    const response = await graphRequest(
      config,
      `/drives/${config.productPhotosDriveId}/items/${file.id}/content`
    );
    if (!response.ok) continue;
    images.push({
      name: file.name,
      mimeType: file.file?.mimeType || "image/jpeg",
      bytes: new Uint8Array(await response.arrayBuffer()),
    });
  }
  return images;
}
