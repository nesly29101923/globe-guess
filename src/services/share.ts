// Sharing: a 9:16 image card in the videos' style (native), or text (web / fallback).
import * as Sharing from 'expo-sharing';
import { Platform, Share, type View } from 'react-native';
type ViewRef = React.ComponentRef<typeof View>;
import { captureRef } from 'react-native-view-shot';
import { analytics } from './analytics';

export async function shareCard(ref: React.RefObject<ViewRef | null>, text: string, where: string): Promise<'shared' | 'copied' | 'failed'> {
  analytics.log('share_tapped', { where });
  try {
    if (Platform.OS !== 'web' && ref.current && (await Sharing.isAvailableAsync())) {
      const uri = await captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1920 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: text });
      return 'shared';
    }
  } catch {
    /* fall back to text */
  }
  return shareText(text);
}

export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (Platform.OS === 'web') {
      const nav = (globalThis as unknown as { navigator?: { share?: (d: { text: string }) => Promise<void>; clipboard?: { writeText: (s: string) => Promise<void> } } }).navigator;
      if (nav?.share) {
        await nav.share({ text });
        return 'shared';
      }
      if (nav?.clipboard) {
        await nav.clipboard.writeText(text);
        return 'copied';
      }
      return 'failed';
    }
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}
