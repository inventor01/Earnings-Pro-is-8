import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';

// Full-screen mascot intro animation shown once per cold start, right after the
// native splash hides. Muted (autoplay-safe), tap anywhere to skip, and a hard
// timeout guarantees it can never strand the user if playback stalls.
// Intro plays at 5x, so the safety timeout can be much tighter than before.
const PLAYBACK_RATE = 5;
const MAX_INTRO_MS = 3000;
// Cross-fade duration when the intro ends/skips: the overlay (holding the last
// video frame) fades out over the already-rendered app underneath.
const FADE_MS = 500;

export default function IntroVideo({ onDone }: { onDone: () => void }) {
  const [unmounted, setUnmounted] = useState(false);
  const fadingRef = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const player = useVideoPlayer(require('@/assets/intro.mp4'), (p) => {
    p.loop = false;
    p.muted = true;
    p.playbackRate = PLAYBACK_RATE;
    p.play();
  });

  // Fade the overlay out (with a subtle zoom-through) instead of unmounting
  // instantly. The player is left alone so the last frame stays visible during
  // the fade; expo-video releases it automatically on unmount.
  const finish = () => {
    if (fadingRef.current) return;
    fadingRef.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.04,
        duration: FADE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setUnmounted(true);
      onDone();
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

  if (unmounted) return null;

  return (
    <Animated.View
      style={[styles.overlay, { opacity, transform: [{ scale }] }]}
      // Let taps fall through to the app as soon as the fade starts.
      pointerEvents={fadingRef.current ? 'none' : 'auto'}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel="Skip intro">
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          pointerEvents="none"
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#101418', // matches the intro video's own background
    zIndex: 9999,
  },
});
