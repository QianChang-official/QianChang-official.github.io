import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play, Pause, Volume2, Headphones, SkipForward, SkipBack,
  Shuffle, Repeat, Repeat1, ListMusic, Loader2, Music, Upload,
  Radio, Activity, Waves, ChevronDown, ChevronUp, X, RefreshCw
} from 'lucide-react';
import { useAudioStore } from '@/hooks/useAudioStore';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { globalAudio, type Track } from '@/stores/audioStore';
import { FILTER_TYPES, EQ_PRESETS, DEFAULT_SURROUND } from '@/audio/engine';
import type { EqBandConfig, SurroundParams } from '@/audio/engine';

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

const WORKER_API = 'https://qianchang-r2-audio.3174837085.workers.dev/api/audio/list';
const DEFAULT_WORKER = 'https://qianchang-r2-audio.3174837085.workers.dev';
const DEFAULT_PUBLIC_BASE = 'https://pub-ae8ff9e688d7481da1eab0ed3dd2a2fd.r2.dev';

const SURROUND_PRESETS: Record<string, Partial<SurroundParams>> = {
  music: { centerGain: 1, surroundWidth: 1, lpFreq: 8000, hpFreq: 150, eqGain: 0, delayTime: 15, surroundGain: 0.9, outputGain: 0.8 },
  movie: { centerGain: 1.2, surroundWidth: 1.3, lpFreq: 7000, hpFreq: 200, eqGain: 2, delayTime: 25, surroundGain: 1.1, outputGain: 0.8 },
  voice: { centerGain: 1.4, surroundWidth: 0.3, lpFreq: 5000, hpFreq: 300, eqGain: -2, delayTime: 5, surroundGain: 0.3, outputGain: 0.8 },
  wide: { centerGain: 0.8, surroundWidth: 1.8, lpFreq: 12000, hpFreq: 80, eqGain: 3, delayTime: 12, surroundGain: 1.3, outputGain: 0.8 },
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
  let size = bytes, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return size.toFixed(unit ? 1 : 0) + ' ' + units[unit];
}

function getStored(key: string, fallback = '') {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
}

/* ========== Spectrum Draw ========== */
function drawSpectrum(canvas: HTMLCanvasElement | null, data: Uint8Array | null, c1: string, c2: string) {
  if (!canvas || !data) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bars = 90;
  const step = Math.floor(data.length / bars);
  let x = 0;
  const barW = (canvas.width / bars) * 0.85;
  for (let i = 0; i < bars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
    const h = (sum / step / 255) * canvas.height;
    const g = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - h);
    g.addColorStop(0, c2);
    g.addColorStop(1, c1);
    ctx.fillStyle = g;
    ctx.fillRect(x, canvas.height - h, barW, h);
    x += barW + 2;
  }
}

function drawResponseCurve(canvas: HTMLCanvasElement | null, filters: BiquadFilterNode[]) {
  if (!canvas || filters.length === 0 || filters.some(f => !f)) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let db = -24; db <= 24; db += 6) {
    const y = h / 2 - (db / 24) * (h / 2);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '10px monospace';
    ctx.fillText(db + 'dB', 4, y - 2);
  }
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * w;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '10px monospace';
    ctx.fillText(i + 'k', x + 2, h - 4);
  }
  const freqs = new Float32Array(512);
  const totalMag = new Float32Array(512).fill(1.0);
  const mag = new Float32Array(512);
  const phase = new Float32Array(512);
  for (let i = 0; i < 512; i++) freqs[i] = 20 * Math.pow(1000, i / 511);
  try {
    filters.forEach(f => {
      if (!f) return;
      f.getFrequencyResponse(freqs, mag, phase);
      for (let i = 0; i < 512; i++) totalMag[i] *= mag[i];
    });
    ctx.beginPath(); ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2;
    for (let i = 0; i < 512; i++) {
      const x = (i / 511) * w;
      const db = 20 * Math.log10(Math.max(totalMag[i], 0.0001));
      const y = h / 2 - (db / 24) * (h / 2);
      if (i === 0) ctx.moveTo(x, Math.max(0, Math.min(h, y)));
      else ctx.lineTo(x, Math.max(0, Math.min(h, y)));
    }
    ctx.stroke();
    ctx.lineTo(w, h / 2); ctx.lineTo(0, h / 2); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(212,175,55,0.15)');
    grad.addColorStop(0.5, 'rgba(212,175,55,0.02)');
    grad.addColorStop(1, 'rgba(212,175,55,0.15)');
    ctx.fillStyle = grad; ctx.fill();
  } catch {}
}

/* ========== Component ========== */
export default function MusicPlayer() {
  /* ---- Store ---- */
  const { tracks, currentTrack, isPlaying, togglePlay, playTrack, setTracks } = useAudioStore();

  /* ---- Engine ---- */
  const engine = useAudioEngine();

  /* ---- UI State ---- */
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playMode, setPlayMode] = useState<PlayMode>('sequential');
  const [playedRandomIndices, setPlayedRandomIndices] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('playlist');
  const [showEq, setShowEq] = useState(false);
  const [showSurround, setShowSurround] = useState(false);
  const [showSpectrum, setShowSpectrum] = useState(false);

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

  /* ---- Fetch tracks ---- */
  useEffect(() => {
    let cancelled = false;
    fetch(WORKER_API)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data: any) => {
        if (cancelled) return;
        const files = data.objects || data || [];
        const parsed = files.map((f: any) => {
          const { artist, title } = parseFilename(f.name || f.key || '');
          return { artist, title, url: f.url };
        });
        setTracks(parsed);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setLoading(false); setError(true); } });
    return () => { cancelled = true; };
  }, [setTracks]);

  /* ---- Audio error listener ---- */
  useEffect(() => {
    const onError = () => setError(true);
    globalAudio.addEventListener('error', onError);
    return () => globalAudio.removeEventListener('error', onError);
  }, []);

  /* ---- Spectrum animation ---- */
  useEffect(() => {
    if (!expanded) return;
    const draw = () => {
      const { input, output } = engine.getSpectrumData();
      drawSpectrum(spectrumInRef.current, input, '#d4af37', '#b8960c');
      drawSpectrum(spectrumOutRef.current, output, '#00d2ff', '#3a7bd5');
      drawResponseCurve(responseRef.current, engine.getFilters());
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [expanded, engine]);

  /* ---- Playback handlers ---- */
  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    setError(false);
    if (playMode === 'random') {
      let nextIdx: number;
      let newPlayed = [...playedRandomIndices, currentTrack];
      if (newPlayed.length >= tracks.length) newPlayed = [currentTrack];
      do { nextIdx = Math.floor(Math.random() * tracks.length); }
      while (newPlayed.includes(nextIdx) && tracks.length > 1);
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
  const loadUrl = useCallback((url: string) => {
    if (!url) return;
    const name = new URL(url).pathname.split('/').pop() || 'Unknown';
    const { artist, title } = parseFilename(name);
    const newTrack = { title, artist, url: url.trim() };
    setTracks([newTrack, ...tracks]);
    globalAudio.src = newTrack.url;
    globalAudio.play().catch(() => setError(true));
    setExpanded(true);
  }, [tracks, setTracks]);

  const loadLocalFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file); objectUrlRef.current = url;
    const { artist, title } = parseFilename(file.name);
    const newTrack = { title, artist, url, size: file.size };
    setTracks([newTrack, ...tracks]);
    globalAudio.src = url;
    globalAudio.play().catch(() => setError(true));
  }, [tracks, setTracks]);

  /* ---- R2 handlers ---- */
  const refreshList = useCallback(async () => {
    const api = workerApi.replace(/\/+$/, '');
    if (!api) { setR2Status('请配置 Worker API'); return; }
    setLoadingList(true); setR2Status('读取中...');
    try {
      const res = await fetch(api + '/api/audio/list');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const objects: R2Object[] = data.objects || [];
      setR2Objects(objects);
      const parsed = objects.map(obj => {
        const name = obj.originalName || obj.key.split('/').pop() || obj.key;
        const { artist, title } = parseFilename(name);
        return { artist, title, url: publicBase.replace(/\/+$/, '') + '/' + obj.key, key: obj.key, size: obj.size };
      });
      setTracks(parsed);
      setR2Status(`${objects.length} 个音源`);
    } catch (err: any) { setR2Status('失败: ' + err.message); }
    finally { setLoadingList(false); }
  }, [workerApi, publicBase, setTracks]);

  const uploadFile = useCallback(async (file: File) => {
    const api = workerApi.replace(/\/+$/, '');
    if (!api) { setR2Status('请配置 Worker API'); return; }
    if (file.size > 90 * 1024 * 1024) { setR2Status('超过 90MB'); return; }
    setR2Status('上传中...');
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch(api + '/api/audio/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setR2Status('上传成功'); refreshList();
    } catch (err: any) { setR2Status('失败: ' + err.message); }
  }, [workerApi, refreshList]);

  /* ---- Surround presets ---- */
  const applySurroundPreset = useCallback((name: string) => {
    const preset = SURROUND_PRESETS[name];
    if (preset) {
      engine.updateSurroundParams(preset);
      engine.toggleSurroundState(true);
    }
  }, [engine]);

  const ModeIcon = MODE_ICONS[playMode];
  const track = tracks[currentTrack];

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
    <div className={`fixed z-[9998] transition-all duration-300 ${expanded ? 'bottom-4 right-4 left-4 md:left-auto md:w-[480px] max-h-[85vh]' : 'bottom-6 right-6'}`}>
      {/* Collapsed */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
            isPlaying
              ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)] shadow-[0_0_20px_rgba(212,175,55,0.4)]'
              : 'bg-[var(--flux-marble-dark)] border border-[var(--flux-line)] text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)]'
          }`}
        >
          {isPlaying ? <Music className="w-6 h-6" /> : <Headphones className="w-6 h-6" />}
        </button>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="rounded-2xl bg-[var(--flux-marble-dark)]/95 backdrop-blur-xl border border-[var(--flux-line)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--flux-line)]/50 shrink-0">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[var(--flux-gold)]" />
              <span className="text-sm font-medium text-[var(--flux-ink)]">{track?.title || '无音源'}</span>
            </div>
            <button onClick={() => setExpanded(false)} className="p-1 text-[var(--flux-ink-light)] hover:text-[var(--flux-ink)]">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto scrollbar-hidden">
            {/* Track Info */}
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-12 h-12 rounded-full bg-[var(--flux-gold)]/10 border border-[var(--flux-gold)]/30 flex items-center justify-center ${isPlaying ? 'animate-pulse' : ''}`}>
                  <Headphones className="w-6 h-6 text-[var(--flux-gold)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--flux-ink)] truncate">{track?.title || '无音源'}</p>
                  <p className="text-xs text-[var(--flux-ink-light)] truncate">{track?.artist || ''}</p>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 mb-2 px-2 py-1 rounded bg-red-500/10">音源不可用</p>
              )}

              {/* Controls */}
              <div className="flex items-center justify-center gap-3 mb-2">
                <button onClick={handlePrev} disabled={tracks.length === 0}
                  className="p-2 rounded-full text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] disabled:opacity-30">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={() => { setError(false); togglePlay(); }} disabled={tracks.length === 0}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isPlaying ? 'bg-[var(--flux-gold)] text-[var(--flux-marble)]' : 'bg-[var(--flux-line)] text-[var(--flux-ink-light)]'
                  } disabled:opacity-30`}>
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </button>
                <button onClick={handleNext} disabled={tracks.length === 0}
                  className="p-2 rounded-full text-[var(--flux-ink-light)] hover:text-[var(--flux-gold)] disabled:opacity-30">
                  <SkipForward className="w-5 h-5" />
                </button>
                <button onClick={toggleMode}
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-[var(--flux-line)]/50 text-[var(--flux-ink-light)]">
                  <ModeIcon className="w-3 h-3" /> {MODE_LABELS[playMode]}
                </button>
              </div>

              {/* Native controls for progress */}
              <audio ref={el => {
                if (el && globalAudio !== el) {
                  // This is just for display - globalAudio is the actual player
                }
              }} src={globalAudio.src} className="w-full h-8 mb-2" controls />
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--flux-line)]/50 px-2">
              {([
                { key: 'playlist', label: '列表', icon: ListMusic },
                { key: 'eq', label: 'EQ', icon: Activity },
                { key: 'surround', label: '环绕', icon: Radio },
                { key: 'spectrum', label: '频谱', icon: Waves },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors ${
                    activeTab === t.key ? 'text-[var(--flux-gold)] border-b-2 border-[var(--flux-gold)]' : 'text-[var(--flux-ink-light)]'
                  }`}>
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="px-4 py-3">
              {/* Playlist Tab */}
              {activeTab === 'playlist' && (
                <div className="space-y-3">
                  {/* Track list */}
                  <div className="max-h-48 overflow-y-auto scrollbar-hidden space-y-1">
                    {tracks.length === 0 ? (
                      <p className="text-xs text-center py-4 text-[var(--flux-ink-light)]">暂无音源</p>
                    ) : (
                      tracks.map((t, i) => (
                        <button key={i} onClick={() => { setError(false); playTrack(i); }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-all ${
                            currentTrack === i ? 'bg-[var(--flux-gold)]/10 text-[var(--flux-gold)]' : 'text-[var(--flux-ink-light)] hover:bg-black/5'
                          }`}
003e
                          <span className="w-4">{i + 1}</span>
                          <span className="truncate flex-1">{t.title}</span>
                          {currentTrack === i && isPlaying && (
                            <span className="flex gap-0.5">
                              {[0, 150, 300].map(d => (
                                <span key={d} className="w-0.5 h-3 bg-[var(--flux-gold)] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                              ))}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Load URL */}
                  <div className="flex gap-2">
                    <input type="url" placeholder="https://.../track.flac"
                      className="flex-1 min-h-[2rem] rounded-lg px-2 text-xs border outline-none"
                      style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)', color: 'var(--flux-ink)' }}
                      onKeyDown={e => { if (e.key === 'Enter') loadUrl((e.target as HTMLInputElement).value); }} />
                    <button onClick={e => loadUrl((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
                      className="px-3 rounded-lg text-xs font-medium"
                      style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}>
                      载入
                    </button>
                  </div>

                  {/* Local file */}
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-dashed cursor-pointer text-xs"
                    style={{ borderColor: 'var(--flux-gold)', background: 'rgba(212,175,55,0.05)', color: 'var(--flux-ink)' }}>
                    <input type="file" accept="audio/*,.flac" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) loadLocalFile(f); }} />
                    <Upload className="w-3.5 h-3.5" /> 选择本地音源
                  </label>

                  {/* R2 Refresh */}
                  <div className="flex items-center gap-2">
                    <button onClick={refreshList} disabled={loadingList}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border"
                      style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                      <RefreshCw className={`w-3 h-3 ${loadingList ? 'animate-spin' : ''}`} /> 刷新 R2
                    </button>
                    <span className="text-xs text-[var(--flux-ink-light)]">{r2Status}</span>
                  </div>

                  {/* R2 Objects mini list */}
                  {r2Objects.length > 0 && (
                    <div className="max-h-32 overflow-y-auto scrollbar-hidden space-y-1">
                      {r2Objects.map(obj => {
                        const name = obj.originalName || obj.key.split('/').pop() || obj.key;
                        const url = publicBase.replace(/\/+$/, '') + '/' + obj.key;
                        return (
                          <div key={obj.key} className="flex items-center justify-between text-xs px-2 py-1 rounded"
                            style={{ background: 'rgba(0,0,0,0.04)' }}>
                            <span className="truncate flex-1 text-[var(--flux-ink)]">{name}</span>
                            <button onClick={() => loadUrl(url)}
                              className="px-2 py-0.5 rounded text-xs"
                              style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}>
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
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {Object.keys(EQ_PRESETS).map(name => (
                      <button key={name} onClick={() => engine.applyPreset(name)}
                        className="px-2 py-1 rounded text-xs border"
                        style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                        {name}
                      </button>
                    ))}
                    <button onClick={engine.resetEqBands}
                      className="px-2 py-1 rounded text-xs border"
                      style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                      重置
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {engine.eqBands.map((band, i) => (
                      <div key={band.id} className="rounded-lg border p-2 text-xs"
                        style={{ borderColor: 'var(--flux-line)', background: 'rgba(255,255,255,0.5)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold" style={{ color: 'var(--flux-ink)' }}>{band.label}Hz</span>
                          <select value={band.type}
                            onChange={e => engine.updateEqBand(i, { type: e.target.value as BiquadFilterType })}
                            className="text-xs rounded border px-1 py-0.5 outline-none"
                            style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)', color: 'var(--flux-ink)' }}>
                            {FILTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <input type="range" min="-12" max="12" step="0.5" value={band.gain}
                            onChange={e => engine.updateEqBand(i, { gain: Number(e.target.value) })}
                            className="flex-1" style={{ accentColor: 'var(--flux-gold)' }} />
                          <span className="w-10 text-right font-mono" style={{ color: 'var(--flux-gold)' }}>{band.gain.toFixed(1)}dB</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span style={{ color: 'var(--flux-ink-light)' }}>Q</span>
                          <input type="range" min="0.1" max="10" step="0.1" value={band.Q}
                            onChange={e => engine.updateEqBand(i, { Q: Number(e.target.value) })}
                            className="flex-1" style={{ accentColor: 'var(--flux-gold)' }} />
                          <span className="w-10 text-right font-mono" style={{ color: 'var(--flux-ink-light)' }}>{band.Q.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-2">
                      <span>预增益</span>
                      <input type="range" min="-12" max="6" step="0.5" value={engine.preamp}
                        onChange={e => engine.updatePreamp(Number(e.target.value))}
                        className="w-20" style={{ accentColor: 'var(--flux-gold)' }} />
                      <span>{engine.preamp}dB</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={engine.limiterOn}
                        onChange={e => engine.updateLimiter(e.target.checked)}
                        className="accent-amber-600" />
                      <span>限幅</span>
                    </label>
                  </div>

                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--flux-line)' }}>
                    <canvas ref={responseRef} width={400} height={100} className="w-full" style={{ background: '#0b1220' }} />
                  </div>
                </div>
              )}

              {/* Surround Tab */}
              {activeTab === 'surround' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--flux-gold)' }}>差分环绕声</span>
                    <button onClick={() => engine.toggleSurroundState(!engine.surroundEnabled)}
                      className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: engine.surroundEnabled ? 'var(--flux-gold)' : 'var(--flux-line)',
                        color: engine.surroundEnabled ? 'var(--flux-marble)' : 'var(--flux-ink-light)'
                      }}>
                      {engine.surroundEnabled ? '已启用' : '已关闭'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries({ music: '音乐', movie: '电影', voice: '语音', wide: '超宽' }).map(([key, label]) => (
                      <button key={key} onClick={() => applySurroundPreset(key)}
                        className="px-2 py-1 rounded text-xs border"
                        style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'centerGain', label: 'Center', min: 0, max: 2, step: 0.01 },
                      { key: 'surroundWidth', label: '宽度', min: 0, max: 2, step: 0.01 },
                      { key: 'hpFreq', label: '高通', min: 20, max: 1000, step: 10, unit: 'Hz' },
                      { key: 'lpFreq', label: '低通', min: 1000, max: 16000, step: 100, unit: 'Hz' },
                      { key: 'eqGain', label: 'EQ增益', min: -12, max: 12, step: 0.5, unit: 'dB' },
                      { key: 'delayTime', label: '延迟', min: 0, max: 50, step: 0.5, unit: 'ms' },
                      { key: 'surroundGain', label: '环绕增益', min: 0, max: 2, step: 0.01 },
                      { key: 'outputGain', label: '总增益', min: 0, max: 2, step: 0.01 },
                    ] as const).map(p => (
                      <div key={p.key} className="rounded-lg border p-2 text-xs" style={{ borderColor: 'var(--flux-line)' }}>
                        <div className="flex justify-between mb-1">
                          <span style={{ color: 'var(--flux-ink-light)' }}>{p.label}</span>
                          <span className="font-mono" style={{ color: 'var(--flux-gold)' }}>
                            {p.unit === 'Hz' ? Math.round(engine.surroundParams[p.key]) + 'Hz'
                              : p.unit === 'dB' ? engine.surroundParams[p.key].toFixed(1) + 'dB'
                              : p.unit === 'ms' ? engine.surroundParams[p.key].toFixed(1) + 'ms'
                              : engine.surroundParams[p.key].toFixed(2)}
                          </span>
                        </div>
                        <input type="range" min={p.min} max={p.max} step={p.step}
                          value={engine.surroundParams[p.key]}
                          onChange={e => engine.updateSurroundParam(p.key, Number(e.target.value))}
                          className="w-full" style={{ accentColor: 'var(--flux-gold)' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Spectrum Tab */}
              {activeTab === 'spectrum' && (
                <div className="space-y-2">
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--flux-line)' }}>
                    <div className="flex items-center gap-1 px-2 py-1 border-b" style={{ borderColor: 'var(--flux-line)' }}>
                      <Activity className="w-3 h-3" style={{ color: 'var(--flux-gold)' }} />
                      <span className="text-xs" style={{ color: 'var(--flux-ink)' }}>输入频谱</span>
                    </div>
                    <canvas ref={spectrumInRef} width={400} height={80} className="w-full" style={{ background: '#0b1220' }} />
                  </div>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--flux-line)' }}>
                    <div className="flex items-center gap-1 px-2 py-1 border-b" style={{ borderColor: 'var(--flux-line)' }}>
                      <Waves className="w-3 h-3" style={{ color: 'var(--flux-gold)' }} />
                      <span className="text-xs" style={{ color: 'var(--flux-ink)' }}>输出频谱（EQ+环绕）</span>
                    </div>
                    <canvas ref={spectrumOutRef} width={400} height={80} className="w-full" style={{ background: '#0b1220' }} />
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
