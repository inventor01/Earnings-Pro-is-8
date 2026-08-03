import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';

// Full-screen mascot intro animation shown once per cold start, right after the
// native splash hides. Muted (autoplay-safe), tap anywhere to skip, and a hard
// timeout guarantees it can never strand the user if playback stalls.
const MAX_INTRO_MS = 6000;

export default function IntroVideo({ onDone }: { onDone: () => void }) {
  const [finished, setFinished] = useState(false);
  const player = useVideoPlayer(require('@/assets/intro.mp4'), (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  const finish = () => {
    setFinished((prev) => {
      if (!prev) onDone();
      return true;
    });
  };

  useEventListener(player, 'playToEnd', finish);
  // Safety net: if the video errors or never starts, don't block the app.
  useEffect(() => {
    const t = setTimeout(finish, MAX_INTRO_MS);
    return () => clearTimeout(t);
  }, []);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') finish();
  });

  if (finished) return null;

  return (
    <Pressable style={styles.overlay} onPress={finish} accessibilityLabel="Skip intro">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        pointerEvents="none"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#101418', // matches the intro video's own background
    zIndex: 9999,
  },
});
