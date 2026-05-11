/* ========== Global Audio Store ========== */

export interface Track {
  title: string;
  artist: string;
  url: string;
  key?: string;
  size?: number;
}

interface AudioState {
  tracks: Track[];
  currentTrack: number;
  isPlaying: boolean;
}

let state: AudioState = {
  tracks: [],
  currentTrack: 0,
  isPlaying: false,
};

const listeners = new Set<() => void>();

export function getAudioState() {
  return state;
}

export function setAudioState(patch: Partial<AudioState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function subscribeAudioStore(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Global audio singleton — shared across MusicPlayer and AudioConsole
export const globalAudio = (() => {
  const audio = document.createElement('audio');
  audio.crossOrigin = 'anonymous';
  audio.volume = 0.6;
  audio.preload = 'metadata';
  return audio;
})();
