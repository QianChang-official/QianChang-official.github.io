import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, Headphones, SkipForward, SkipBack, Shuffle, Repeat, Repeat1, ListMusic, Loader2 } from 'lucide-react';

interface AudioFile {
  name: string;
  url: string;
  size: number;
  lastModified: string;
}

interface Track {
  title: string;
  artist: string;
  url: string;
}

type PlayMode = 'sequential' | 'loop-all' | 'loop-one' | 'random';

const MODE_ICONS: Record<PlayMode, typeof Repeat> = {
  sequential: ListMusic,
  'loop-all': Repeat,
  'loop-one': Repeat1,
  random: Shuffle,
};

const MODE_LABELS: Record<PlayMode, string> = {
  sequential: '顺序播放',
  'loop-all': '列表循环',
  'loop-one': '单曲循环',
  random: '随机播放',
};

const WORKER_API = 'https://qianchang-r2-audio.3174837085.workers.dev/api/audio/list';

function parseFilename(name: string): { artist: string; title: string } {
  const clean = name.replace(/\.[^/.]+$/, '').trim();
  const sep = clean.indexOf(' - ');
  if (sep > 0) {
    return {
      artist: clean.slice(0, sep).trim(),
      title: clean.slice(sep + 3).trim(),
    };
  }
  return { artist: 'Unknown', title: clean };
}

export default function MusicPlayer() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playMode, setPlayMode] = useState<PlayMode>('sequential');
  const [playedRandomIndices, setPlayedRandomIndices] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch tracks from Cloudflare R2
  useEffect(() => {
    let cancelled = false;
    fetch(WORKER_API)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch audio list');
        return res.json();
      })
      .then((data: AudioFile[]) => {
        if (cancelled) return;
        const parsed = data.map((f) => {
          const { artist, title } = parseFilename(f.name);
          return { artist, title, url: f.url };
        });
        setTracks(parsed);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.5;
    audioRef.current = audio;

    const handleEnded = () => {
      if (tracks.length === 0) return;
      switch (playMode) {
        case 'loop-one':
          audio.currentTime = 0;
          audio.play().catch(() => setIsPlaying(false));
          break;
        case 'sequential':
          if (currentTrack < tracks.length - 1) {
            setCurrentTrack((prev) => prev + 1);
          } else {
            setIsPlaying(false);
          }
          break;
        case 'loop-all':
          setCurrentTrack((prev) => (prev + 1) % tracks.length);
          break;
        case 'random':
          setCurrentTrack((prev) => {
            let nextIdx: number;
            let newPlayed = [...playedRandomIndices, prev];
            if (newPlayed.length >= tracks.length) {
              newPlayed = [prev];
            }
            do {
              nextIdx = Math.floor(Math.random() * tracks.length);
            } while (newPlayed.includes(nextIdx) && tracks.length > 1);
            setPlayedRandomIndices(newPlayed);
            return nextIdx;
          });
          break;
      }
    };

    const handleError = () => {
      setError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [tracks.length, playMode, currentTrack, playedRandomIndices]);

  // Load and play when track or isPlaying changes
  useEffect(() => {
    if (!audioRef.current || tracks.length === 0) return;
    const audio = audioRef.current;
    if (isPlaying) {
      if (audio.src !== tracks[currentTrack].url) {
        audio.src = tracks[currentTrack].url;
      }
      audio.play().catch(() => {
        setError(true);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack, tracks]);

  const togglePlay = useCallback(() => {
    if (tracks.length === 0) return;
    setError(false);
    setIsPlaying((p) => !p);
  }, [tracks.length]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    setError(false);
    if (playMode === 'random') {
      let nextIdx: number;
      let newPlayed = [...playedRandomIndices, currentTrack];
      if (newPlayed.length >= tracks.length) {
        newPlayed = [currentTrack];
      }
      do {
        nextIdx = Math.floor(Math.random() * tracks.length);
      } while (newPlayed.includes(nextIdx) && tracks.length > 1);
      setPlayedRandomIndices(newPlayed);
      setCurrentTrack(nextIdx);
    } else {
      setCurrentTrack((prev) => (prev + 1) % tracks.length);
    }
    setIsPlaying(true);
  }, [tracks.length, playMode, currentTrack, playedRandomIndices]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    setError(false);
    setCurrentTrack((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length]);

  const toggleMode = useCallback(() => {
    const modes: PlayMode[] = ['sequential', 'loop-all', 'loop-one', 'random'];
    const idx = modes.indexOf(playMode);
    setPlayMode(modes[(idx + 1) % modes.length]);
  }, [playMode]);

  const ModeIcon = MODE_ICONS[playMode];

  if (loading) {
    return (
      <div className="fixed bottom-6 right-6 z-[9998]">
        <button className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed z-[9998] transition-all duration-300 bottom-6 right-6">
      {/* Collapsed State - Floating Button */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
            isPlaying
              ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)] shadow-[0_0_20px_rgba(212,175,55,0.4)]'
              : 'bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:border-[var(--flux-gold)]/30'
          }`}
        >
          <Headphones className="w-5 h-5" />
        </button>
      )}

      {/* Expanded State - Mini Player */}
      {expanded && (
        <div className="w-80 rounded-2xl bg-[var(--flux-marble-dark)]/95 backdrop-blur-xl border border-[var(--flux-line)] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--flux-line)]/50">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[var(--flux-gold)]" />
              <span className="text-sm font-medium text-[var(--flux-ink)]">音源</span>
            </div>
            <button
              onClick={() => setExpanded(false)}
              className="p-1 rounded text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)] transition-colors"
            >
              <span className="text-lg leading-none">&times;</span>
            </button>
          </div>

          {/* Track Info */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-full bg-[var(--flux-gold)]/10 border border-[var(--flux-gold)]/30 flex items-center justify-center ${
                  isPlaying ? 'animate-pulse' : ''
                }`}
              >
                <Headphones className="w-5 h-5 text-[var(--flux-gold)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--flux-ink)] truncate">
                  {tracks[currentTrack]?.title ?? '无音源'}
                </p>
                <p className="text-xs text-[var(--flux-ink-light)] truncate">
                  {tracks[currentTrack]?.artist ?? ''}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 mb-3 px-2 py-1.5 rounded bg-red-500/10">
                该音源暂不可用，请尝试其他曲目
              </p>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <button
                onClick={handlePrev}
                disabled={tracks.length === 0}
                className="p-2 rounded-full text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-black/5 transition-all disabled:opacity-30"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                disabled={tracks.length === 0}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isPlaying
                    ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'bg-[var(--flux-line)] text-[var(--flux-ink-light)] hover:bg-[var(--flux-gold)]/20 hover:text-[var(--flux-gold)]'
                } disabled:opacity-30`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={handleNext}
                disabled={tracks.length === 0}
                className="p-2 rounded-full text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] hover:bg-black/5 transition-all disabled:opacity-30"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center justify-center mb-4">
              <button
                onClick={toggleMode}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[var(--flux-line)]/50 text-[var(--flux-ink-light)] hover:bg-[var(--flux-gold)]/10 hover:text-[var(--flux-gold)] transition-all"
                title={MODE_LABELS[playMode]}
              >
                <ModeIcon className="w-3.5 h-3.5" />
                <span>{MODE_LABELS[playMode]}</span>
              </button>
            </div>

            {/* Track List */}
            <div className="mt-2 pt-3 border-t border-[var(--flux-line)]/30 max-h-40 overflow-y-auto scrollbar-hidden">
              {tracks.length === 0 ? (
                <p className="text-xs text-[var(--flux-ink-light)] text-center py-4">暂无音源</p>
              ) : (
                tracks.map((track, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setCurrentTrack(i);
                      setError(false);
                      setIsPlaying(true);
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all ${
                      currentTrack === i
                        ? 'bg-[var(--flux-gold)]/10 text-[var(--flux-gold)]'
                        : 'text-[var(--flux-ink-light)] hover:bg-black/5 hover:text-[var(--flux-ink)]'
                    }`}
                  >
                    <span className="text-xs w-4">{i + 1}</span>
                    <span className="text-xs truncate flex-1">{track.title}</span>
                    {currentTrack === i && isPlaying && (
                      <span className="flex gap-0.5">
                        <span className="w-0.5 h-3 bg-[var(--flux-gold)] animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-0.5 h-3 bg-[var(--flux-gold)] animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-0.5 h-3 bg-[var(--flux-gold)] animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
