---
name: Audio focus / external music interruption
description: expo-video and expo-audio claim audio focus by default and pause Spotify/Apple Music even for muted, audio-less media.
---

Muted playback is NOT enough: expo-video claims the audio session/audio focus when playback starts even when `muted=true` and the mp4 has no audio track, pausing the user's Spotify/Apple Music/podcast. expo-audio's default session does the same the first time a sound plays.

**Why:** the launch intro video (video-only mp4, muted) still stopped users' music.

**How to apply:** every visual-only video player must set `player.audioMixingMode = 'mixWithOthers'`; every `setAudioModeAsync` call must pass `interruptionMode: 'mixWithOthers'` (works on both platforms; `interruptionModeAndroid` is deprecated). Short confirmation sounds should layer over external audio, never duck or pause it. Verify on device with music playing — simulators/tsc can't catch this.
