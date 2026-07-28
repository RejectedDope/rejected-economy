import * as MediaLibrary from 'expo-media-library';
import { Linking, Platform } from 'react-native';
import type { AlbumSummary } from '@/src/types/media';

export type PermissionState = {
  granted: boolean;
  canAskAgain: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
};

export async function getPermissionState(): Promise<PermissionState> {
  const result = await MediaLibrary.getPermissionsAsync();
  return {
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    accessPrivileges: result.accessPrivileges ?? 'none',
  };
}

export async function requestPhotoPermission(): Promise<PermissionState> {
  const result = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
  return {
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    accessPrivileges: result.accessPrivileges ?? 'none',
  };
}

export async function openAppSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
  } else {
    await Linking.openSettings();
  }
}

export async function loadAlbums(): Promise<AlbumSummary[]> {
  const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });

  const summaries = await Promise.all(
    albums.map(async (album) => {
      let thumbnailUri: string | undefined;
      try {
        const assets = await MediaLibrary.getAssetsAsync({
          album,
          first: 1,
          mediaType: ['photo'],
          sortBy: [MediaLibrary.SortBy.creationTime],
        });
        thumbnailUri = assets.assets[0]?.uri;
      } catch {
        thumbnailUri = undefined;
      }

      return {
        id: album.id,
        title: album.title,
        assetCount: album.assetCount,
        thumbnailUri,
      } satisfies AlbumSummary;
    })
  );

  return summaries
    .filter((album) => album.assetCount > 0)
    .sort((a, b) => b.assetCount - a.assetCount || a.title.localeCompare(b.title));
}
