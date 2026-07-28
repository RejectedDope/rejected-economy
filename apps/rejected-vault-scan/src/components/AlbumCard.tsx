import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { AlbumSummary } from '@/src/types/media';

export function AlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <View style={styles.card}>
      <View style={styles.thumbWrap}>
        {album.thumbnailUri ? (
          <Image source={album.thumbnailUri} style={styles.thumb} contentFit="cover" transition={150} />
        ) : (
          <View style={styles.placeholder}><Text style={styles.placeholderText}>No preview</Text></View>
        )}
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>{album.title}</Text>
        <Text style={styles.count}>{album.assetCount.toLocaleString()} photos</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: '#F4EFE7', borderRadius: 18, padding: 10, gap: 12, alignItems: 'center' },
  thumbWrap: { width: 74, height: 74, borderRadius: 14, overflow: 'hidden', backgroundColor: '#DDD4C7' },
  thumb: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  placeholderText: { fontSize: 11, color: '#655F57', textAlign: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '700', color: '#161514' },
  count: { fontSize: 14, marginTop: 4, color: '#655F57' },
});
