import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Headphones } from 'lucide-react';

const TRACKS = [
  {
    title: 'River Flows In You',
    artist: 'Yiruma',
    url: 'https://music.163.com/song/media/outer/url?id=22842399.mp3',
  },
  {
    title: ' golden hour',
    artist: 'JVKE',
    url: 'https://music.163.com/song/media/outer/url?id=1960594294.mp3',
  },
  {
    title: '所念皆星河',
    artist: 'CMJ',
    url: 'https://music.163.com/song/media/outer/url?id=1491251668.mp3',
  },
  {
    title: 'City of Stars',
    artist: 'Ryan Gosling',
    url: 'https://music.163.com/song/media/outer/url?id=441491147.mp3',
  },
  {
    title: '夜曲',
    artist: '周杰伦',
    url: 'https://music.163.com/song/media/outer/url?id=186009.mp3',
  },
];

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.5;
    audioRef.current = audio;

    const handleEnded = () => {
      setCurrentTrack((prev) => (prev + 1) % TRACKS.length);
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
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.src = TRACKS[currentTrack].url;
      audioRef.current.play().catch(() => {
        setError(true);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  const togglePlay = () => {
    setError(false);
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    setError(false);
    setCurrentTrack((prev) => (prev + 1) % TRACKS.length);
  };

  return (
    <div
      className={`fixed z-[9998] transition-all duration-300 ${
        expanded ? 'bottom-6 right-6' : 'bottom-6 right-6'
      }`}
    >
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
        <div className="w-72 rounded-2xl bg-[var(--flux-marble-dark)]/95 backdrop-blur-xl border border-[var(--flux-line)] shadow-2xl overflow-hidden">
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
                  {TRACKS[currentTrack].title}
                </p>
                <p className="text-xs text-[var(--flux-ink-light)] truncate">
                  {TRACKS[currentTrack].artist}
                </p>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 mb-3 px-2 py-1.5 rounded bg-red-500/10">
                该音源暂不可用，请尝试下一首
              </p>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={togglePlay}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isPlaying
                    ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)] shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                    : 'bg-[var(--flux-line)] text-[var(--flux-ink-light)] hover:bg-[var(--flux-gold)]/20 hover:text-[var(--flux-gold)]'
                }`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-2 rounded-full text-xs bg-[var(--flux-line)] text-[var(--flux-ink-light)] hover:bg-[var(--flux-gold)]/20 hover:text-[var(--flux-gold)] transition-all"
              >
                下一首
              </button>
            </div>

            {/* Track List */}
            <div className="mt-4 pt-4 border-t border-[var(--flux-line)]/30 max-h-36 overflow-y-auto scrollbar-hidden">
              {TRACKS.map((track, i) => (
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
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
