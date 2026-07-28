import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { AlbumCard } from '@/src/components/AlbumCard';
import { getPermissionState, loadAlbums, openAppSettings, requestPhotoPermission, type PermissionState } from '@/src/services/mediaLibrary';
import type { AlbumSummary } from '@/src/types/media';

export default function HomeScreen() {
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getPermissionState();
      setPermission(current);
      if (current.granted) {
        setAlbums(await loadAlbums());
      } else {
        setAlbums([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to read the photo library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestPhotoPermission();
      setPermission(result);
      if (result.granted) {
        setAlbums(await loadAlbums());
      } else if (!result.canAskAgain) {
        Alert.alert('Photo access is off', 'Open iPhone Settings to allow full or selected photo access.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void openAppSettings() },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request photo access.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator size="large" /><Text style={styles.loading}>Checking your photo access…</Text></View></SafeAreaView>;
  }

  if (!permission?.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>REJECTED VAULT SCAN</Text>
          <Text style={styles.headline}>Find what you already own.</Text>
          <Text style={styles.body}>Connect the albums you authorize. Phase 1 reads your real iPhone albums directly—no individual uploads and no listing automation.</Text>
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Private first step</Text>
            <Text style={styles.noticeBody}>This test only checks permission, album names, photo counts, and thumbnails. It does not send your photos anywhere.</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={() => void connect()}><Text style={styles.primaryText}>Connect My Photos</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const limited = permission.accessPrivileges === 'limited';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PHASE 1 DEVICE TEST</Text>
        <Text style={styles.headlineSmall}>Your authorized albums</Text>
        <Text style={styles.body}>{limited ? 'Selected Photos Only is active. Counts and albums may reflect only what iOS currently exposes.' : 'Full Photo Access is active.'}</Text>
        <View style={[styles.badge, limited && styles.badgeWarn]}><Text style={styles.badgeText}>{limited ? 'LIMITED ACCESS' : 'FULL ACCESS'}</Text></View>
        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={() => void refresh()}><Text style={styles.secondaryText}>Refresh</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => void openAppSettings()}><Text style={styles.secondaryText}>Photo Settings</Text></Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AlbumCard album={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No albums returned</Text><Text style={styles.body}>Open Photo Settings, adjust access, then return and tap Refresh.</Text></View>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FBF8F3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loading: { color: '#5B554F' },
  hero: { flex: 1, padding: 24, justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: '#8A4D2A' },
  headline: { fontSize: 44, lineHeight: 46, fontWeight: '900', color: '#161514', marginTop: 10 },
  headlineSmall: { fontSize: 32, lineHeight: 34, fontWeight: '900', color: '#161514', marginTop: 8 },
  body: { fontSize: 16, lineHeight: 23, color: '#5B554F', marginTop: 12 },
  notice: { marginTop: 22, padding: 16, borderRadius: 16, backgroundColor: '#EDE3D6' },
  noticeTitle: { fontSize: 16, fontWeight: '800', color: '#161514' },
  noticeBody: { fontSize: 14, lineHeight: 20, color: '#5B554F', marginTop: 6 },
  primary: { marginTop: 26, backgroundColor: '#171513', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  error: { marginTop: 14, color: '#A12622', fontSize: 14, lineHeight: 20 },
  badge: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#D7E6D3', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  badgeWarn: { backgroundColor: '#F2D9AE' },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#312D29' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  secondary: { borderWidth: 1, borderColor: '#C7BBAE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { fontWeight: '700', color: '#312D29' },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  empty: { marginTop: 30, padding: 20, borderRadius: 16, backgroundColor: '#F4EFE7' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#161514' },
});
