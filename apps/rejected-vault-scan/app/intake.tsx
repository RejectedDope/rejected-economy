import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { loadAlbumPhotos } from '@/src/services/mediaLibrary';
import {
  getSavedConnectionKey,
  saveConnectionKey,
  uploadPhotoBatch,
  type UploadProgress,
} from '@/src/services/photoIntake';
import type { PhotoAsset } from '@/src/types/media';

const MAX_PHOTOS = 25;

export default function IntakeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ albumId?: string; title?: string }>();
  const [assets, setAssets] = useState<PhotoAsset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sku, setSku] = useState('');
  const [connectionKey, setConnectionKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selected.has(asset.id)),
    [assets, selected]
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      params.albumId ? loadAlbumPhotos(params.albumId) : Promise.resolve([]),
      getSavedConnectionKey(),
    ]).then(([photos, savedKey]) => {
      if (!active) return;
      setAssets(photos);
      setConnectionKey(savedKey);
      setLoading(false);
    }).catch((error) => {
      if (!active) return;
      setLoading(false);
      Alert.alert('Unable to open album', error instanceof Error ? error.message : 'Unknown error');
    });
    return () => { active = false; };
  }, [params.albumId]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PHOTOS) next.add(id);
      else Alert.alert('Batch limit reached', `Choose up to ${MAX_PHOTOS} photos per SKU.`);
      return next;
    });
  };

  const upload = async () => {
    if (!sku.trim()) return Alert.alert('SKU required', 'Enter the existing SharePoint Inventory SKU.');
    if (!selectedAssets.length) return Alert.alert('Photos required', 'Select at least one photo.');
    try {
      setUploading(true);
      await saveConnectionKey(connectionKey);
      const result = await uploadPhotoBatch({
        sku,
        assets: selectedAssets,
        connectionKey: connectionKey.trim(),
        onProgress: setProgress,
      });
      Alert.alert(
        result.failures ? 'Batch needs review' : 'Listing photos ready',
        `${result.batchId}\n${result.status}${result.failures ? ` — ${result.failures} failed` : ''}`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Upload stopped', error instanceof Error ? error.message : 'Unknown upload error');
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Albums</Text></Pressable>
          <Text style={styles.eyebrow}>PHOTO INTAKE</Text>
          <Text style={styles.title}>{params.title || 'Selected album'}</Text>
          <Text style={styles.help}>One existing SKU applies to this entire batch. Originals are preserved before processing.</Text>
          <TextInput
            value={sku}
            onChangeText={setSku}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Existing SKU, e.g. RT-0241"
            style={styles.input}
          />
          <TextInput
            value={connectionKey}
            onChangeText={setConnectionKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="Private connection key"
            style={styles.input}
          />
          <View style={styles.selectionRow}>
            <Text style={styles.selection}>{selected.size} of {MAX_PHOTOS} selected</Text>
            <Pressable onPress={() => setSelected(new Set())}><Text style={styles.clear}>Clear</Text></Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" /></View>
        ) : (
          <FlatList
            data={assets}
            numColumns={3}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.row}
            renderItem={({ item }) => {
              const chosen = selected.has(item.id);
              return (
                <Pressable style={[styles.photoWrap, chosen && styles.photoSelected]} onPress={() => toggle(item.id)}>
                  <Image source={item.uri} style={styles.photo} contentFit="cover" alt={item.filename} />
                  {chosen ? <View style={styles.check}><Text style={styles.checkText}>✓</Text></View> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No authorized photos were returned for this album.</Text>}
          />
        )}

        <View style={styles.footer}>
          {progress ? <Text style={styles.progress}>Processing {progress.current}/{progress.total}: {progress.label}</Text> : null}
          <Pressable style={[styles.primary, uploading && styles.disabled]} onPress={() => void upload()} disabled={uploading}>
            {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Preserve & Process Photos</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF8F3' },
  header: { paddingHorizontal: 18, paddingTop: 8 },
  back: { color: '#8A4D2A', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#8A4D2A' },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '900', color: '#161514', marginTop: 4 },
  help: { color: '#5B554F', fontSize: 14, lineHeight: 19, marginTop: 6 },
  input: { marginTop: 10, borderWidth: 1, borderColor: '#C7BBAE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFF', color: '#161514' },
  selectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 8 },
  selection: { fontWeight: '700', color: '#312D29' },
  clear: { fontWeight: '700', color: '#8A4D2A', textDecorationLine: 'underline' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { paddingHorizontal: 12, paddingBottom: 130 },
  row: { gap: 6, marginBottom: 6 },
  photoWrap: { flex: 1, aspectRatio: 1, borderRadius: 10, overflow: 'hidden', borderWidth: 3, borderColor: 'transparent' },
  photoSelected: { borderColor: '#8A4D2A' },
  photo: { width: '100%', height: '100%' },
  check: { position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, backgroundColor: '#8A4D2A', alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#FFF', fontWeight: '900' },
  empty: { padding: 24, textAlign: 'center', color: '#5B554F' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: '#FBF8F3', borderTopWidth: 1, borderTopColor: '#E2D9CE' },
  progress: { fontSize: 12, color: '#5B554F', marginBottom: 8 },
  primary: { backgroundColor: '#171513', borderRadius: 15, paddingVertical: 15, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
