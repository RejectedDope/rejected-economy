import * as ImageManipulator from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import { resolveOriginalAsset } from './mediaLibrary';
import type { PhotoAsset } from '@/src/types/media';

const KEY_NAME = 'rejected-photo-intake-key';

type BatchStart = {
  batchId: string;
  batchToken: string;
  sku: string;
  inventoryTitle: string;
};

export type UploadProgress = {
  current: number;
  total: number;
  label: string;
};

export type InventoryDraft = {
  inventoryItemId: string;
  sku: string;
  title: string;
  status: string;
};

function apiUrl(path: string): string {
  const base = process.env.EXPO_PUBLIC_PHOTO_INTAKE_API_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Photo Intake server URL is not configured in this build.');
  return `${base}${path}`;
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

export async function getSavedConnectionKey(): Promise<string> {
  return (await SecureStore.getItemAsync(KEY_NAME)) ?? '';
}

export async function saveConnectionKey(value: string): Promise<void> {
  const key = value.trim();
  if (key.length < 20) throw new Error('Connection key is too short.');
  await SecureStore.setItemAsync(KEY_NAME, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function createInventoryDraft(args: {
  title: string;
  purchaseCost?: number;
  sourceStore?: string;
  location: string;
  connectionKey: string;
}): Promise<InventoryDraft> {
  return responseJson<InventoryDraft>(
    await fetch(apiUrl('/api/photo-intake/inventory'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-photo-intake-key': args.connectionKey,
      },
      body: JSON.stringify({
        title: args.title,
        purchaseCost: args.purchaseCost,
        sourceStore: args.sourceStore,
        location: args.location,
        dateAcquired: new Date().toISOString().slice(0, 10),
      }),
    })
  );
}

function defaultRole(index: number): string {
  if (index === 0) return 'front';
  if (index === 1) return 'back';
  if (index === 2) return 'label';
  return 'detail';
}

export async function uploadPhotoBatch(args: {
  sku: string;
  assets: PhotoAsset[];
  connectionKey: string;
  onProgress: (progress: UploadProgress) => void;
}): Promise<{ batchId: string; status: string; failures: number }> {
  const sku = args.sku.trim().toUpperCase();
  const headers = {
    'content-type': 'application/json',
    'x-photo-intake-key': args.connectionKey,
  };
  const started = await responseJson<BatchStart>(
    await fetch(apiUrl('/api/photo-intake/batches'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ sku, expectedCount: args.assets.length }),
    })
  );

  let completed = 0;
  let failed = 0;
  let primaryPhotoUrl: string | undefined;

  for (let index = 0; index < args.assets.length; index += 1) {
    const asset = args.assets[index];
    args.onProgress({ current: index + 1, total: args.assets.length, label: asset.filename });
    try {
      const original = await resolveOriginalAsset(asset.id);
      const preview = await ImageManipulator.manipulateAsync(
        original.uri,
        [{ resize: { width: 2200 } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      const form = new FormData();
      form.append('batchToken', started.batchToken);
      form.append('sequence', String(index + 1));
      form.append('role', defaultRole(index));
      form.append('original', { uri: original.uri, name: original.filename, type: original.mimeType } as never);
      form.append('preview', { uri: preview.uri, name: `preview-${index + 1}.jpg`, type: 'image/jpeg' } as never);

      const uploaded = await responseJson<{ listingUrl: string }>(
        await fetch(apiUrl(`/api/photo-intake/batches/${started.batchId}/photos`), {
          method: 'POST',
          headers: { 'x-photo-intake-key': args.connectionKey },
          body: form,
        })
      );
      primaryPhotoUrl ||= uploaded.listingUrl;
      completed += 1;
    } catch (error) {
      console.warn(`Photo ${index + 1} failed to upload`, error);
      failed += 1;
    }
  }

  const result = await responseJson<{ status: string }>(
    await fetch(apiUrl(`/api/photo-intake/batches/${started.batchId}/complete`), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        batchToken: started.batchToken,
        completedCount: completed,
        failedCount: failed,
        primaryPhotoUrl,
      }),
    })
  );

  return { batchId: started.batchId, status: result.status, failures: failed };
}
