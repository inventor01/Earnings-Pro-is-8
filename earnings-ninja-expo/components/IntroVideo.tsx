import { Component, ReactNode, useEffect, useRef, useState } from 'react';
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

// The intro is pure decoration — a native video failure (bad codec, surface
// creation failure on some Android devices, expo-video init throw) must never
// take the app down at startup. Any render/mount error inside the intro is
// caught here and treated exactly like "intro finished": the boundary reports
// done and renders nothing, so the app underneath continues normally.
class IntroErrorBoundary extends Component<
  { onDone: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[IntroVideo] intro failed, skipping:', error);
    this.props.onDone();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function IntroVideo({ onDone }: { onDone: () => void }) {
  return (
    <IntroErrorBoundary onDone={onDone}>
      <IntroVideoInner onDone={onDone} />
    </IntroErrorBoundary>
  );
}

function IntroVideoInner({ onDone }: { onDone: () => void }) {
  const [unmounted, setUnmounted] = useState(false);
  // Android's native video layer fades unreliably (frames can stay stuck on
  // top of the app). So when the intro ends we remove the video immediately
  // and fade out a plain solid-color overlay instead — that's a normal view,
  // so the cross-fade to the app underneath is always smooth.
  const [videoGone, setVideoGone] = useState(false);
  const fadingRef = useRef(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const player = useVideoPlayer(require('@/assets/intro.mp4'), (p) => {
    // Any throw inside this native setup callback (e.g. an unsupported
    // playbackRate or audio-session config on a given Android device) must
    // not escape — it would surface as an async native error after launch.
    // The MAX_INTRO_MS timeout below still guarantees the intro clears.
    try {
      p.loop = false;
      p.muted = true;
      // The intro is purely visual (the mp4 has no audio track and is muted),
      // but by default expo-video still claims the audio session / audio focus
      // when playback starts — which pauses Spotify/Apple Music/podcasts on
      // launch. mixWithOthers keeps external audio playing untouched.
      p.audioMixingMode = 'mixWithOthers';
      p.playbackRate = PLAYBACK_RATE;
      p.play();
    } catch (e) {
      if (__DEV__) console.warn('[IntroVideo] player setup failed:', e);
    }
  });

  // Fade the overlay out (with a subtle zoom-through) instead of unmounting
  // instantly. The player is left alone so the last frame stays visible during
  // the fade; expo-video releases it automatically on unmount.
  const finish = () => {
    if (fadingRef.current) return;
    fadingRef.current = true;
    setVideoGone(true);
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
        {!videoGone && <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          pointerEvents="none"
          // Android: the default SurfaceView ignores the parent's animated
          // opacity, so the last video frame stayed fully opaque over the
          // login screen during the fade-out. TextureView composites like a
          // normal view, so the cross-fade actually applies to the video.
          surfaceType="textureView"
        />}
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
