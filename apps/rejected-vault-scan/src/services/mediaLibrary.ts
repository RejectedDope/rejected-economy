import * as MediaLibrary from 'expo-media-library';
import { Linking, Platform } from 'react-native';
import type { AlbumSummary } from '@/src/types/media';

export type PermissionState = {
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges: 'all' | 'limited' | 'none';
};

function normalizePermission(result: MediaLibrary.PermissionResponse): PermissionState {
  return {
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    accessPrivileges: result.accessPrivileges ?? 'none',
  };
}

export async function getPermissionState(): Promise<PermissionState> {
  return normalizePermission(await MediaLibrary.getPermissionsAsync(false, ['photo']));
}

export async function requestPhotoPermission(): Promise<PermissionState> {
  return normalizePermission(await MediaLibrary.requestPermissionsAsync(false, ['photo']));
}

export async function manageSelectedPhotos(): Promise<void> {
  await MediaLibrary.presentPermissionsPicker(['photo']);
}

export async function openAppSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
    return;
  }
  await Linking.openSettings();
}

export async function loadAlbums(): Promise<AlbumSummary[]> {
  const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });

  const summaries = await Promise.all(
    albums.map(async (album) => {
      let thumbnailUri: string | undefined;
      let visibleAssetCount = album.assetCount;

      try {
        const assets = await MediaLibrary.getAssetsAsync({
          album,
          first: 1,
          mediaType: ['photo'],
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });
        thumbnailUri = assets.assets[0]?.uri;

        // Under limited iOS access, album.assetCount can describe the full album
        // while the app can only see selected assets. Use the paginated total when available.
        if (typeof assets.totalCount === 'number') {
          visibleAssetCount = assets.totalCount;
        }
      } catch {
        thumbnailUri = undefined;
      }

      return {
        id: album.id,
        title: album.title,
        assetCount: visibleAssetCount,
        thumbnailUri,
      } satisfies AlbumSummary;
    })
  );

  return summaries
    .filter((album) => album.assetCount > 0 || Boolean(album.thumbnailUri))
    .sort((a, b) => b.assetCount - a.assetCount || a.title.localeCompare(b.title));
}
