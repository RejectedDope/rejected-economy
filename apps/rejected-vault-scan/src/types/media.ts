export type AlbumSummary = {
  id: string;
  title: string;
  assetCount: number;
  thumbnailUri?: string;
};

export type PhotoAsset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: string;
  width: number;
  height: number;
};
