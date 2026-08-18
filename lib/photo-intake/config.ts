export type PhotoIntakeConfig = {
  apiKey: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteId: string;
  inventoryListId: string;
  productPhotosDriveId: string;
  backgroundRemovalUrl?: string;
  backgroundRemovalToken?: string;
  openAiApiKey?: string;
  resaleIqModel: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getPhotoIntakeConfig(): PhotoIntakeConfig {
  return {
    apiKey: required("PHOTO_INTAKE_KEY"),
    tenantId: required("MS_TENANT_ID"),
    clientId: required("MS_CLIENT_ID"),
    clientSecret: required("MS_CLIENT_SECRET"),
    siteId: required("SHAREPOINT_SITE_ID"),
    inventoryListId: required("SHAREPOINT_INVENTORY_LIST_ID"),
    productPhotosDriveId: required("SHAREPOINT_PRODUCT_PHOTOS_DRIVE_ID"),
    backgroundRemovalUrl: process.env.BACKGROUND_REMOVAL_API_URL?.trim() || undefined,
    backgroundRemovalToken: process.env.BACKGROUND_REMOVAL_API_TOKEN?.trim(),
    openAiApiKey: process.env.OPENAI_API_KEY?.trim(),
    resaleIqModel: process.env.RESALEIQ_RESEARCH_MODEL?.trim() || "gpt-5.6",
  };
}

export function assertPhotoIntakeRequest(request: Request, apiKey: string): void {
  const supplied = request.headers.get("x-photo-intake-key");
  if (!supplied || supplied !== apiKey) throw new Error("Unauthorized");
}
