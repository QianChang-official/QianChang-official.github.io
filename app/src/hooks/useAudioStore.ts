import { useState, useEffect, useCallback } from 'react';
import { subscribeAudioStore, getAudioState, setAudioState, globalAudio, type Track } from '@/stores/audioStore';

export function useAudioStore() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return subscribeAudioStore(() => forceUpdate({}));
  }, []);

  const state = getAudioState();

  const setTracks = useCallback((tracks: Track[]) => {
    setAudioState({ tracks });
  }, []);

  const setCurrentTrack = useCallback((index: number) => {
    setAudioState({ currentTrack: index });
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setAudioState({ isPlaying: playing });
  }, []);

  const playTrack = useCallback((index: number) => {
    const { tracks } = getAudioState();
    if (tracks.length === 0 || index < 0 || index >= tracks.length) return;
    const url = tracks[index]?.url;
    if (url && globalAudio.src !== url) globalAudio.src = url;
    globalAudio.play().catch(() => setAudioState({ isPlaying: false }));
    setAudioState({ currentTrack: index, isPlaying: true });
  }, []);

  const togglePlay = useCallback(() => {
    const { tracks, isPlaying } = getAudioState();
    if (tracks.length === 0 && !globalAudio.src) return;
    if (isPlaying) {
      globalAudio.pause();
      setAudioState({ isPlaying: false });
    } else {
      globalAudio.play().catch(() => setAudioState({ isPlaying: false }));
      setAudioState({ isPlaying: true });
    }
  }, []);

  const nextTrack = useCallback(() => {
    const { tracks, currentTrack } = getAudioState();
    if (tracks.length === 0) return;
    const next = (currentTrack + 1) % tracks.length;
    playTrack(next);
  }, [playTrack]);

  const prevTrack = useCallback(() => {
    const { tracks, currentTrack } = getAudioState();
    if (tracks.length === 0) return;
    const prev = (currentTrack - 1 + tracks.length) % tracks.length;
    playTrack(prev);
  }, [playTrack]);

  // Sync audio ended/error events back to store
  useEffect(() => {
    const onEnded = () => {
      const { tracks, currentTrack } = getAudioState();
      if (currentTrack < tracks.length - 1) {
        const next = currentTrack + 1;
        const url = tracks[next]?.url;
        if (url) {
          globalAudio.src = url;
          globalAudio.play().catch(() => setAudioState({ isPlaying: false }));
        }
        setAudioState({ currentTrack: next, isPlaying: true });
      } else {
        setAudioState({ isPlaying: false });
      }
    };
    const onError = () => setAudioState({ isPlaying: false });
    globalAudio.addEventListener('ended', onEnded);
    globalAudio.addEventListener('error', onError);
    return () => {
      globalAudio.removeEventListener('ended', onEnded);
      globalAudio.removeEventListener('error', onError);
    };
  }, []);

  return {
    ...state,
    globalAudio,
    setTracks,
    setCurrentTrack,
    setIsPlaying,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
  };
}
