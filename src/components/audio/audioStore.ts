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
  listeners.forEach((fn) => {
    fn();
  });
}

export function subscribeAudioStore(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Remember whether the user had playback going when a client-side swap
// interrupts it, and resume seamlessly on the next page.
let resumeAfterSwap = false;

// Global audio singleton — shared across MusicPlayer and AudioConsole
export const globalAudio = (() => {
  const audio = document.createElement('audio');
  audio.crossOrigin = 'anonymous';
  audio.volume = 0.6;
  audio.preload = 'metadata';
  return audio;
})();

// Park the element on <body> immediately. An <audio> that is created but
// never attached to the document gets torn down (paused) by the browser the
// first time a client-side navigation swaps the DOM around its origin page.
if (typeof document !== 'undefined' && document.body && !globalAudio.isConnected) {
  globalAudio.style.display = 'none';
  document.body.appendChild(globalAudio);
}

// Astro's ClientRouter can pause the media element during a page swap even
// though the element survives. Snapshot intent before the swap and resume
// once the new page has settled — the user never hears a gap.
if (typeof document !== 'undefined') {
  document.addEventListener('astro:before-swap', () => {
    resumeAfterSwap = !globalAudio.paused && !globalAudio.ended;
  });
  document.addEventListener('astro:page-load', () => {
    if (resumeAfterSwap && globalAudio.src) {
      const tryResume = (attemptsLeft: number) => {
        if (!globalAudio.paused) {
          resumeAfterSwap = false;
          return;
        }
        globalAudio.play().catch(() => {});
        if (attemptsLeft > 0) setTimeout(() => tryResume(attemptsLeft - 1), 150);
        else resumeAfterSwap = false;
      };
      setTimeout(() => tryResume(5), 50);
    }
  });
}
