import {
  Activity,
  Headphones,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  Waves,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { globalAudio } from './audioStore';
import { drawResponseCurve, drawSpectrum } from './draw';
import type { SurroundParams } from './engine';
import { EQ_PRESETS, FILTER_TYPES } from './engine';
import { useAudioEngine } from './useAudioEngine';
import { useAudioStore } from './useAudioStore';

/* ========== Types ========== */
type PlayMode = 'sequential' | 'loop-all' | 'loop-one' | 'random';
type Tab = 'playlist' | 'eq' | 'surround' | 'spectrum';

interface R2Object {
  key: string;
  size: number;
  uploaded: string;
  contentType?: string;
  originalName?: string;
}

/* ========== Constants ========== */
const MODE_ICONS: Record<PlayMode, typeof Repeat> = {
  sequential: ListMusic,
  'loop-all': Repeat,
  'loop-one': Repeat1,
  random: Shuffle,
};

const MODE_LABELS: Record<PlayMode, string> = {
  sequential: '顺序',
  'loop-all': '列表循环',
  'loop-one': '单曲循环',
  random: '随机',
};

const DEFAULT_WORKER = 'https://qianchang-r2-audio.3174837085.workers.dev';
const DEFAULT_PUBLIC_BASE = 'https://pub-ae8ff9e688d7481da1eab0ed3dd2a2fd.r2.dev';

const SURROUND_PRESETS: Record<string, Partial<SurroundParams>> = {
  music: {
    centerGain: 1,
    surroundWidth: 1,
    lpFreq: 8000,
    hpFreq: 150,
    eqGain: 0,
    delayTime: 15,
    surroundGain: 0.9,
    outputGain: 0.8,
  },
  movie: {
    centerGain: 1.2,
    surroundWidth: 1.3,
    lpFreq: 7000,
    hpFreq: 200,
    eqGain: 2,
    delayTime: 25,
    surroundGain: 1.1,
    outputGain: 0.8,
  },
  voice: {
    centerGain: 1.4,
    surroundWidth: 0.3,
    lpFreq: 5000,
    hpFreq: 300,
    eqGain: -2,
    delayTime: 5,
    surroundGain: 0.3,
    outputGain: 0.8,
  },
  wide: {
    centerGain: 0.8,
    surroundWidth: 1.8,
    lpFreq: 12000,
    hpFreq: 80,
    eqGain: 3,
    delayTime: 12,
    surroundGain: 1.3,
    outputGain: 0.8,
  },
};

/* ========== Helpers ========== */
function parseFilename(name: string): { artist: string; title: string } {
  const clean = name.replace(/\.[^/.]+$/, '').trim();
  const sep = clean.indexOf(' - ');
  if (sep > 0) return { artist: clean.slice(0, sep).trim(), title: clean.slice(sep + 3).trim() };
  return { artist: 'Unknown', title: clean };
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes,
    unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return size.toFixed(unit ? 1 : 0) + ' ' + units[unit];
}

function getStored(key: string, fallback = '') {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

/* ========== Component ========== */
export default function MusicPlayer() {
  /* ---- Store ---- */
  const { tracks, currentTrack, isPlaying, togglePlay, playTrack, setTracks } = useAudioStore();

  /* ---- Engine ---- */
  const engine = useAudioEngine();
  const { getSpectrumData, getFilters } = engine;

  /* ---- UI State ---- */
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playMode, setPlayMode] = useState<PlayMode>('sequential');
  const [playedRandomIndices, setPlayedRandomIndices] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('playlist');

  /* ---- R2 State ---- */
  const [workerApi, setWorkerApi] = useState(getStored('qcAudioApiBase', DEFAULT_WORKER));
  const [publicBase, setPublicBase] = useState(getStored('qcAudioPublicBase', DEFAULT_PUBLIC_BASE));
  const [r2Objects, setR2Objects] = useState<R2Object[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [r2Status, setR2Status] = useState('');

  /* ---- Refs ---- */
  const spectrumInRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumOutRef = useRef<HTMLCanvasElement | null>(null);
  const responseRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const objectUrlRef = useRef<string | null>(null);

  /* ---- Fetch tracks (respects the stored Worker API address) ---- */
  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch the R2 list once on mount
  useEffect(() => {
    let cancelled = false;
    const api = workerApi.replace(/\/+$/, '');
    fetch(api + '/api/audio/list')
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((data: any) => {
        if (cancelled) return;
        const objects: R2Object[] = data.objects || [];
        const parsed = objects.map((obj) => {
          const name = obj.originalName || obj.key.split('/').pop() || obj.key;
          const { artist, title } = parseFilename(name);
          return { artist, title, url: publicBase.replace(/\/+$/, '') + '/' + obj.key, key: obj.key, size: obj.size };
        });
        setTracks(parsed);
        setR2Objects(objects);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Audio error listener ---- */
  useEffect(() => {
    const onError = () => setError(true);
    globalAudio.addEventListener('error', onError);
    return () => globalAudio.removeEventListener('error', onError);
  }, []);

  /* ---- Spectrum animation ---- */
  useEffect(() => {
    if (!expanded || activeTab !== 'spectrum') return;
    const draw = () => {
      const { input, output } = getSpectrumData();
      drawSpectrum(spectrumInRef.current, input, ['#ed6ea0', '#e91e63']);
      drawSpectrum(spectrumOutRef.current, output, ['#57b5f2', '#2b7fd4']);
      if (activeTab === 'eq') drawResponseCurve(responseRef.current, getFilters());
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [expanded, activeTab, getSpectrumData, getFilters]);

  /* ---- Playback handlers ---- */
  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    setError(false);
    if (playMode === 'random') {
      let nextIdx: number;
      let newPlayed = [...playedRandomIndices, currentTrack];
      if (newPlayed.length >= tracks.length) newPlayed = [currentTrack];
      do {
        nextIdx = Math.floor(Math.random() * tracks.length);
      } while (newPlayed.includes(nextIdx) && tracks.length > 1);
      setPlayedRandomIndices(newPlayed);
      playTrack(nextIdx);
    } else if (playMode === 'loop-one') {
      globalAudio.currentTime = 0;
      globalAudio.play().catch(() => setError(true));
    } else {
      playTrack((currentTrack + 1) % tracks.length);
    }
  }, [tracks.length, playMode, currentTrack, playedRandomIndices, playTrack]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    setError(false);
    playTrack((currentTrack - 1 + tracks.length) % tracks.length);
  }, [tracks.length, currentTrack, playTrack]);

  const toggleMode = useCallback(() => {
    const modes: PlayMode[] = ['sequential', 'loop-all', 'loop-one', 'random'];
    setPlayMode(modes[(modes.indexOf(playMode) + 1) % modes.length]);
  }, [playMode]);

  /* ---- Load handlers ---- */
  const loadUrl = useCallback(
    (url: string) => {
      if (!url) return;
      const name = new URL(url).pathname.split('/').pop() || 'Unknown';
      const { artist, title } = parseFilename(name);
      const newTrack = { title, artist, url: url.trim() };
      setTracks([newTrack, ...tracks]);
      globalAudio.src = newTrack.url;
      globalAudio.play().catch(() => setError(true));
      setExpanded(true);
    },
    [tracks, setTracks],
  );

  const loadLocalFile = useCallback(
    (file: File) => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      const { artist, title } = parseFilename(file.name);
      const newTrack = { title, artist, url, size: file.size };
      setTracks([newTrack, ...tracks]);
      globalAudio.src = url;
      globalAudio.play().catch(() => setError(true));
    },
    [tracks, setTracks],
  );

  /* ---- R2 handlers ---- */
  const refreshList = useCallback(async () => {
    const api = workerApi.replace(/\/+$/, '');
    if (!api) {
      setR2Status('请配置 Worker API');
      return;
    }
    setLoadingList(true);
    setR2Status('读取中...');
    try {
      const res = await fetch(api + '/api/audio/list');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const objects: R2Object[] = data.objects || [];
      setR2Objects(objects);
      const parsed = objects.map((obj) => {
        const name = obj.originalName || obj.key.split('/').pop() || obj.key;
        const { artist, title } = parseFilename(name);
        return { artist, title, url: publicBase.replace(/\/+$/, '') + '/' + obj.key, key: obj.key, size: obj.size };
      });
      setTracks(parsed);
      setR2Status(`${objects.length} 个音源`);
    } catch (err: any) {
      setR2Status('失败: ' + err.message);
    } finally {
      setLoadingList(false);
    }
  }, [workerApi, publicBase, setTracks]);

  const uploadFile = useCallback(
    async (file: File) => {
      const api = workerApi.replace(/\/+$/, '');
      if (!api) {
        setR2Status('请配置 Worker API');
        return;
      }
      if (file.size > 90 * 1024 * 1024) {
        setR2Status('超过 90MB');
        return;
      }
      setR2Status('上传中...');
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(api + '/api/audio/upload', { method: 'POST', body: form });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        setR2Status('上传成功');
        refreshList();
      } catch (err: any) {
        setR2Status('失败: ' + err.message);
      }
    },
    [workerApi, refreshList],
  );

  /* ---- Surround presets ---- */
  const applySurroundPreset = useCallback(
    (name: string) => {
      const preset = SURROUND_PRESETS[name];
      if (preset) {
        engine.updateSurroundParams(preset);
        engine.toggleSurroundState(true);
      }
    },
    [engine],
  );

  const ModeIcon = MODE_ICONS[playMode];
  const track = tracks[currentTrack];

  if (loading) {
    return (
      <div className="fixed right-6 bottom-6 z-[9998]">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-[9998] transition-all duration-300 ${expanded ? 'right-4 bottom-4 left-4 max-h-[85vh] md:left-auto md:w-[480px]' : 'right-6 bottom-6'}`}
    >
      {/* Collapsed */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
            isPlaying
              ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(237,110,160,0.45)]'
              : 'border border-border bg-muted text-muted-foreground hover:text-primary'
          }`}
        >
          {isPlaying ? <Music className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}
        </button>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="flex max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-border/50 border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{track?.title || '无音源'}</span>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="scrollbar-hidden overflow-y-auto">
            {/* Track Info */}
            <div className="px-4 py-3">
              <div className="mb-3 flex items-center gap-3">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10 ${isPlaying ? 'animate-pulse' : ''}`}
                >
                  <Headphones className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">{track?.title || '无音源'}</p>
                  <p className="truncate text-muted-foreground text-xs">
                    {track?.artist || ''}
                    {track?.size ? ` · ${formatSize(track.size)}` : ''}
                  </p>
                </div>
              </div>

              {error && <p className="mb-2 rounded bg-red-500/10 px-2 py-1 text-red-500 text-xs">音源不可用</p>}

              {/* Controls */}
              <div className="mb-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={tracks.length === 0}
                  className="rounded-full p-2 text-muted-foreground hover:text-primary disabled:opacity-30"
                >
                  <SkipBack className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(false);
                    togglePlay();
                  }}
                  disabled={tracks.length === 0}
                  className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
                    isPlaying ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  } disabled:opacity-30`}
                >
                  {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={tracks.length === 0}
                  className="rounded-full p-2 text-muted-foreground hover:text-primary disabled:opacity-30"
                >
                  <SkipForward className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={toggleMode}
                  className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-1 text-muted-foreground text-xs"
                >
                  <ModeIcon className="h-3 w-3" /> {MODE_LABELS[playMode]}
                </button>
              </div>

              {/* Native controls for progress */}
              {/* biome-ignore lint/a11y/useMediaCaption: display-only native progress bar bound to the shared audio element */}
              <audio
                ref={(el) => {
                  if (el && globalAudio !== el) {
                    // This is just for display - globalAudio is the actual player
                  }
                }}
                src={globalAudio.src}
                className="mb-2 h-8 w-full"
                controls
              />
            </div>

            {/* Tabs */}
            <div className="flex border-border/50 border-b px-2">
              {(
                [
                  { key: 'playlist', label: '列表', icon: ListMusic },
                  { key: 'eq', label: 'EQ', icon: Activity },
                  { key: 'surround', label: '环绕', icon: Radio },
                  { key: 'spectrum', label: '频谱', icon: Waves },
                ] as const
              ).map((t) => (
                <button
                  type="button"
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1 px-3 py-2 font-medium text-xs transition-colors ${
                    activeTab === t.key ? 'border-primary border-b-2 text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-4 py-3">
              {/* Playlist Tab */}
              {activeTab === 'playlist' && (
                <div className="space-y-3">
                  {/* Track list */}
                  <div className="scrollbar-hidden max-h-48 space-y-1 overflow-y-auto">
                    {tracks.length === 0 ? (
                      <p className="py-4 text-center text-muted-foreground text-xs">暂无音源</p>
                    ) : (
                      tracks.map((t, i) => (
                        <button
                          type="button"
                          key={t.url || `track-${i}`}
                          onClick={() => {
                            setError(false);
                            playTrack(i);
                          }}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-all ${
                            currentTrack === i ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60'
                          }`}
                        >
                          <span className="w-4">{i + 1}</span>
                          <span className="flex-1 truncate">{t.title}</span>
                          {currentTrack === i && isPlaying && (
                            <span className="flex gap-0.5">
                              {[0, 150, 300].map((d) => (
                                <span
                                  key={d}
                                  className="h-3 w-0.5 animate-bounce bg-primary"
                                  style={{ animationDelay: `${d}ms` }}
                                />
                              ))}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Load URL */}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://.../track.flac"
                      className="min-h-[2rem] flex-1 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadUrl((e.target as HTMLInputElement).value);
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => loadUrl((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
                      className="rounded-lg bg-primary px-3 font-medium text-primary-foreground text-xs hover:opacity-90"
                    >
                      载入
                    </button>
                  </div>

                  {/* Local file */}
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/50 border-dashed bg-primary/5 p-2 text-xs hover:bg-primary/10">
                    <input
                      type="file"
                      accept="audio/*,.flac"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) loadLocalFile(f);
                      }}
                    />
                    <Upload className="h-3.5 w-3.5" /> 选择本地音源
                  </label>

                  {/* R2 Refresh */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshList}
                      disabled={loadingList}
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-muted-foreground text-xs hover:bg-muted/60 hover:text-foreground"
                    >
                      <RefreshCw className={`h-3 w-3 ${loadingList ? 'animate-spin' : ''}`} /> 刷新 R2
                    </button>
                    <span className="text-muted-foreground text-xs">{r2Status}</span>
                  </div>

                  {/* R2 Objects mini list */}
                  {r2Objects.length > 0 && (
                    <div className="scrollbar-hidden max-h-32 space-y-1 overflow-y-auto">
                      {r2Objects.map((obj) => {
                        const name = obj.originalName || obj.key.split('/').pop() || obj.key;
                        const url = publicBase.replace(/\/+$/, '') + '/' + obj.key;
                        return (
                          <div
                            key={obj.key}
                            className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 text-xs"
                          >
                            <span className="flex-1 truncate">{name}</span>
                            <button
                              type="button"
                              onClick={() => loadUrl(url)}
                              className="rounded bg-primary px-2 py-0.5 text-primary-foreground text-xs hover:opacity-90"
                            >
                              播放
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* EQ Tab */}
              {activeTab === 'eq' && (
                <div className="space-y-3">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {Object.keys(EQ_PRESETS).map((name) => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => engine.applyPreset(name)}
                        className="rounded border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-muted/60 hover:text-foreground"
                      >
                        {name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={engine.resetEqBands}
                      className="rounded border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-muted/60 hover:text-foreground"
                    >
                      重置
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {engine.eqBands.map((band, i) => (
                      <div key={band.id} className="rounded-lg border border-border/40 bg-muted/30 p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-bold">{band.label}Hz</span>
                          <select
                            value={band.type}
                            onChange={(e) => engine.updateEqBand(i, { type: e.target.value as BiquadFilterType })}
                            className="rounded border border-border bg-background px-1 py-0.5 text-xs outline-none"
                          >
                            {FILTER_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="range"
                            min="-12"
                            max="12"
                            step="0.5"
                            value={band.gain}
                            onChange={(e) => engine.updateEqBand(i, { gain: Number(e.target.value) })}
                            className="flex-1"
                            style={{ accentColor: 'hsl(var(--primary))' }}
                          />
                          <span className="w-10 text-right font-mono text-primary">{band.gain.toFixed(1)}dB</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="text-muted-foreground">Q</span>
                          <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={band.Q}
                            onChange={(e) => engine.updateEqBand(i, { Q: Number(e.target.value) })}
                            className="flex-1"
                            style={{ accentColor: 'hsl(var(--primary))' }}
                          />
                          <span className="w-10 text-right font-mono text-muted-foreground">{band.Q.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-2">
                      <span>预增益</span>
                      <input
                        type="range"
                        min="-12"
                        max="6"
                        step="0.5"
                        value={engine.preamp}
                        onChange={(e) => engine.updatePreamp(Number(e.target.value))}
                        className="w-20"
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      <span>{engine.preamp}dB</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={engine.limiterOn}
                        onChange={(e) => engine.updateLimiter(e.target.checked)}
                        className="accent-primary"
                      />
                      <span>限幅</span>
                    </label>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <canvas ref={responseRef} width={400} height={100} className="audio-canvas w-full" />
                  </div>
                </div>
              )}

              {/* Surround Tab */}
              {activeTab === 'surround' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-primary text-xs">差分环绕声</span>
                    <button
                      type="button"
                      onClick={() => engine.toggleSurroundState(!engine.surroundEnabled)}
                      className={`rounded-lg px-3 py-1 font-medium text-xs transition-all ${
                        engine.surroundEnabled
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {engine.surroundEnabled ? '已启用' : '已关闭'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries({ music: '音乐', movie: '电影', voice: '语音', wide: '超宽' }).map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => applySurroundPreset(key)}
                        className="rounded border border-border px-2 py-1 text-muted-foreground text-xs hover:bg-muted/60 hover:text-foreground"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { key: 'centerGain', label: 'Center', min: 0, max: 2, step: 0.01 },
                        { key: 'surroundWidth', label: '宽度', min: 0, max: 2, step: 0.01 },
                        { key: 'hpFreq', label: '高通', min: 20, max: 1000, step: 10, unit: 'Hz' },
                        { key: 'lpFreq', label: '低通', min: 1000, max: 16000, step: 100, unit: 'Hz' },
                        { key: 'eqGain', label: 'EQ增益', min: -12, max: 12, step: 0.5, unit: 'dB' },
                        { key: 'delayTime', label: '延迟', min: 0, max: 50, step: 0.5, unit: 'ms' },
                        { key: 'surroundGain', label: '环绕增益', min: 0, max: 2, step: 0.01 },
                        { key: 'outputGain', label: '总增益', min: 0, max: 2, step: 0.01 },
                      ] as const
                    ).map((p) => (
                      <div key={p.key} className="rounded-lg border border-border/40 bg-muted/30 p-2 text-xs">
                        <div className="mb-1 flex justify-between">
                          <span className="text-muted-foreground">{p.label}</span>
                          <span className="font-mono text-primary">
                            {p.unit === 'Hz'
                              ? Math.round(engine.surroundParams[p.key]) + 'Hz'
                              : p.unit === 'dB'
                                ? engine.surroundParams[p.key].toFixed(1) + 'dB'
                                : p.unit === 'ms'
                                  ? engine.surroundParams[p.key].toFixed(1) + 'ms'
                                  : engine.surroundParams[p.key].toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={p.min}
                          max={p.max}
                          step={p.step}
                          value={engine.surroundParams[p.key]}
                          onChange={(e) => engine.updateSurroundParam(p.key, Number(e.target.value))}
                          className="w-full"
                          style={{ accentColor: 'hsl(var(--primary))' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spectrum Tab */}
              {activeTab === 'spectrum' && (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="flex items-center gap-1 border-border/60 border-b px-2 py-1">
                      <Activity className="h-3 w-3 text-primary" />
                      <span className="text-xs">输入频谱</span>
                    </div>
                    <canvas ref={spectrumInRef} width={400} height={80} className="audio-canvas w-full" />
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="flex items-center gap-1 border-border/60 border-b px-2 py-1">
                      <Waves className="h-3 w-3 text-primary" />
                      <span className="text-xs">输出频谱（EQ+环绕）</span>
                    </div>
                    <canvas ref={spectrumOutRef} width={400} height={80} className="audio-canvas w-full" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
