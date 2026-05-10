import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, Headphones,
  Upload, RefreshCw, Trash2, Download, Music, Settings,
  Loader2, AlertCircle, CheckCircle2, Radio, BarChart3
} from 'lucide-react';

interface R2Object {
  key: string;
  size: number;
  uploaded: string;
  contentType?: string;
  originalName?: string;
}

interface Track {
  title: string;
  artist: string;
  url: string;
  key?: string;
  size?: number;
}

const BANDS = [
  { label: '32', freq: 32 },
  { label: '64', freq: 64 },
  { label: '125', freq: 125 },
  { label: '250', freq: 250 },
  { label: '500', freq: 500 },
  { label: '1k', freq: 1000 },
  { label: '4k', freq: 4000 },
  { label: '12k', freq: 12000 },
];

const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0],
  'FLAC Warm': [1.5, 1, 0.5, 0, -0.5, 0.5, 1, 1.5],
  Vocal: [-1.5, -1, 0, 1.5, 2, 1, 0, -0.5],
  Bass: [4, 3, 2, 0, -1, -1, 0, 0],
  Bright: [-1, -1, -0.5, 0, 1, 2, 3, 3.5],
};

const DEFAULT_WORKER = 'https://qianchang-r2-audio.3174837085.workers.dev';
const DEFAULT_PUBLIC_BASE = 'https://pub-ae8ff9e688d7481da1eab0ed3dd2a2fd.r2.dev';

function getStored(key: string, fallback = '') {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

function setStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return size.toFixed(unit ? 1 : 0) + ' ' + units[unit];
}

function parseFilename(name: string): { artist: string; title: string } {
  const clean = name.replace(/\.[^/.]+$/, '').trim();
  const sep = clean.indexOf(' - ');
  if (sep > 0) {
    return { artist: clean.slice(0, sep).trim(), title: clean.slice(sep + 3).trim() };
  }
  return { artist: 'Unknown', title: clean };
}

export default function AudioConsole() {
  // Player state
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [statusMsg, setStatusMsg] = useState('等待载入音源');

  // EQ state
  const [eqGains, setEqGains] = useState<number[]>(new Array(8).fill(0));
  const [preamp, setPreamp] = useState(-1);
  const [limiterOn, setLimiterOn] = useState(true);
  const [hifiMode, setHifiMode] = useState(true);

  // R2 state
  const [workerApi, setWorkerApi] = useState(getStored('qcAudioApiBase', DEFAULT_WORKER));
  const [publicBase, setPublicBase] = useState(getStored('qcAudioPublicBase', DEFAULT_PUBLIC_BASE));
  const [devToken, setDevToken] = useState(getStored('qcAudioDevToken', ''));
  const [storageStatus, setStorageStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [r2Objects, setR2Objects] = useState<R2Object[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const preampRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const objectUrlRef = useRef<string | null>(null);

  // Build audio graph once
  const ensureGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioCtxRef.current) return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      setStatusMsg('当前浏览器不支持 Web Audio API，EQ 已禁用。');
      return;
    }

    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaElementSource(audio);
    sourceRef.current = source;

    const pre = ctx.createGain();
    pre.gain.value = Math.pow(10, preamp / 20);
    preampRef.current = pre;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = limiterOn ? -4 : 0;
    comp.knee.value = 10;
    comp.ratio.value = limiterOn ? 6 : 1;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    compressorRef.current = comp;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    let prev = source;
    filtersRef.current = BANDS.map((band, i) => {
      const f = ctx.createBiquadFilter();
      f.type = 'peaking';
      f.frequency.value = band.freq;
      f.Q.value = 1.05;
      f.gain.value = eqGains[i];
      prev.connect(f);
      prev = f;
      return f;
    });

    prev.connect(pre);
    pre.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);
  }, [eqGains, preamp, limiterOn]);

  // Update EQ when gains change
  useEffect(() => {
    filtersRef.current.forEach((f, i) => {
      if (f) f.gain.value = eqGains[i];
    });
  }, [eqGains]);

  // Update preamp
  useEffect(() => {
    if (preampRef.current) {
      preampRef.current.gain.value = Math.pow(10, preamp / 20);
    }
  }, [preamp]);

  // Update limiter
  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = limiterOn ? -4 : 0;
      compressorRef.current.ratio.value = limiterOn ? 6 : 1;
    }
  }, [limiterOn]);

  // Spectrum animation
  useEffect(() => {
    const canvas = spectrumCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Draw bars
      const barCount = 64;
      const barWidth = w / barCount;
      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bufferLength * 0.5);
        const value = dataArray[idx] || 0;
        const barHeight = (value / 255) * h;
        const x = i * barWidth;
        const y = h - barHeight;

        const grad = ctx.createLinearGradient(0, h, 0, y);
        grad.addColorStop(0, 'rgba(212,175,55,0.8)');
        grad.addColorStop(1, 'rgba(212,175,55,0.2)');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y, barWidth - 2, barHeight);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [analyserRef.current]);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.6;
    audioRef.current = audio;

    const onEnded = () => {
      if (currentTrack < tracks.length - 1) {
        setCurrentTrack((p) => p + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => {
      setPlayerError('音源载入失败');
      setIsPlaying(false);
    };
    const onPlay = () => {
      ensureGraph();
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') ctx.resume();
    };
    const onLoaded = () => {
      const label = audio.currentSrc.split('/').pop() || '当前音源';
      setStatusMsg('已载入：' + decodeURIComponent(label));
      setPlayerError('');
    };

    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('loadedmetadata', onLoaded);

    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('loadedmetadata', onLoaded);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [tracks.length, ensureGraph]);

  // Play track when currentTrack or isPlaying changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) return;
    if (isPlaying) {
      const url = tracks[currentTrack]?.url;
      if (url && audio.src !== url) {
        audio.src = url;
      }
      audio.play().catch(() => {
        setPlayerError('播放失败');
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack, tracks]);

  // Load R2 list on mount
  useEffect(() => {
    refreshList();
  }, []);

  const loadUrl = useCallback((url: string, label?: string) => {
    if (!audioRef.current || !url) {
      setStatusMsg('请输入可访问的音源 URL');
      return;
    }
    audioRef.current.src = url.trim();
    audioRef.current.load();
    setStatusMsg('正在载入：' + (label || url));
    setIsPlaying(true);
  }, []);

  const loadLocalFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    loadUrl(url, file.name);
  }, [loadUrl]);

  const togglePlay = useCallback(() => {
    if (tracks.length === 0 && !audioRef.current?.src) return;
    setIsPlaying((p) => !p);
  }, [tracks.length]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrack((p) => (p + 1) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrack((p) => (p - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length]);

  const setBand = useCallback((index: number, gain: number) => {
    setEqGains((prev) => {
      const next = [...prev];
      next[index] = gain;
      return next;
    });
    if (filtersRef.current[index]) {
      filtersRef.current[index].gain.value = gain;
    }
  }, []);

  const applyPreset = useCallback((name: string) => {
    const values = EQ_PRESETS[name] || EQ_PRESETS.Flat;
    setEqGains(values);
    values.forEach((g, i) => {
      if (filtersRef.current[i]) filtersRef.current[i].gain.value = g;
    });
    setStatusMsg('已应用 EQ 预设：' + name);
  }, []);

  const refreshList = useCallback(async () => {
    const api = workerApi.replace(/\/+$/, '');
    if (!api) {
      setStorageStatus('请先填写 Worker API 地址');
      return;
    }
    setLoadingList(true);
    setStorageStatus('正在读取 R2 列表...');
    try {
      const res = await fetch(api + '/api/audio/list');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const objects: R2Object[] = data.objects || [];
      setR2Objects(objects);

      const parsedTracks: Track[] = objects.map((obj) => {
        const name = obj.originalName || obj.key.split('/').pop() || obj.key;
        const { artist, title } = parseFilename(name);
        return {
          artist,
          title,
          url: publicBase.replace(/\/+$/, '') + '/' + obj.key,
          key: obj.key,
          size: obj.size,
        };
      });
      setTracks(parsedTracks);
      setStorageStatus(`已读取 ${objects.length} 个对象`);
    } catch (err: any) {
      setStorageStatus('列表读取失败：' + err.message);
    } finally {
      setLoadingList(false);
    }
  }, [workerApi, publicBase]);

  const uploadFile = useCallback(async (file: File) => {
    const api = workerApi.replace(/\/+$/, '');
    if (!api) {
      setStorageStatus('请先填写 Worker API 地址');
      return;
    }
    if (!file) {
      setStorageStatus('请选择要上传的音源文件');
      return;
    }
    if (file.size > 90 * 1024 * 1024) {
      setStorageStatus('文件超过 90MB 限制');
      return;
    }
    setUploading(true);
    setStorageStatus('正在上传：' + file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(api + '/api/audio/upload', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setStorageStatus('上传完成：' + data.key);
      refreshList();
    } catch (err: any) {
      setStorageStatus('上传失败：' + err.message);
    } finally {
      setUploading(false);
    }
  }, [workerApi, refreshList]);

  const deleteObject = useCallback(async (key: string) => {
    const api = workerApi.replace(/\/+$/, '');
    if (!devToken) {
      setStorageStatus('删除需要开发者令牌');
      return;
    }
    setStorageStatus('正在删除...');
    try {
      const res = await fetch(api + '/api/audio/delete?key=' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: { 'x-developer-key': devToken },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStorageStatus('已删除：' + key);
      refreshList();
    } catch (err: any) {
      setStorageStatus('删除失败：' + err.message);
    }
  }, [workerApi, devToken, refreshList]);

  return (
    <div className="pt-20 pb-12 min-h-screen marble-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="mb-10">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>
            R2 Audio Workspace
          </span>
          <h1 className="text-4xl md:text-5xl font-black mt-2 mb-4" style={{ color: 'var(--flux-ink)' }}>
            音源控制台
          </h1>
          <p className="max-w-2xl text-sm md:text-base leading-relaxed" style={{ color: 'var(--flux-ink-light)' }}>
            面向 FLAC、WAV、MP3 与 OGG 的网页播放工作台。播放器使用浏览器原生解码，EQ 使用 Web Audio API 滤波器链；上传和列表通过 Worker 接入 R2，删除需要开发者令牌。
          </p>
          <div className="grid grid-cols-3 gap-3 mt-6 max-w-lg">
            {[
              { label: '公共下载域', value: 'r2.dev' },
              { label: '默认桶', value: 'r2-server' },
              { label: '删除权限', value: 'Developer' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl p-3 border" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
                <span className="text-xs block mb-1" style={{ color: 'var(--flux-ink-light)' }}>{item.label}</span>
                <strong className="text-sm" style={{ color: 'var(--flux-gold)' }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player Panel */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>Playback</span>
                  <h2 className="text-lg font-bold mt-1" style={{ color: 'var(--flux-ink)' }}>播放与解码</h2>
                </div>
                <button
                  onClick={() => applyPreset('Flat')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-md"
                  style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}
                >
                  重置 EQ
                </button>
              </div>

              {/* URL Input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="url"
                  placeholder="https://.../track.flac"
                  className="flex-1 min-h-[2.75rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                  style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadUrl((e.target as HTMLInputElement).value);
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    loadUrl(input.value);
                  }}
                  className="px-4 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}
                >
                  载入 URL
                </button>
              </div>

              {/* Local File */}
              <label className="flex flex-col gap-1 mb-4 p-4 rounded-xl border border-dashed cursor-pointer transition-all hover:opacity-80"
                style={{ borderColor: 'var(--flux-gold)', background: 'rgba(212,175,55,0.05)' }}>
                <input
                  type="file"
                  accept="audio/*,.flac"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadLocalFile(file);
                  }}
                />
                <span className="text-sm font-medium" style={{ color: 'var(--flux-ink)' }}>选择本地音源试听</span>
                <span className="text-xs" style={{ color: 'var(--flux-ink-light)' }}>本地文件不会上传，适合先检查 FLAC 兼容性和 EQ 效果</span>
              </label>

              {/* Audio Element */}
              <audio
                ref={(el) => { if (el) audioRef.current = el; }}
                controls
                preload="metadata"
                crossOrigin="anonymous"
                className="w-full mb-3"
              />

              {/* Status */}
              <div className="rounded-lg px-3 py-2 text-sm mb-4" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--flux-ink-light)' }}>
                {playerError ? (
                  <span className="flex items-center gap-1.5 text-red-500">
                    <AlertCircle className="w-3.5 h-3.5" /> {playerError}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--flux-gold)' }} /> {statusMsg}
                  </span>
                )}
              </div>

              {/* Spectrum */}
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--flux-line)' }}>
                <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--flux-line)' }}>
                  <BarChart3 className="w-3.5 h-3.5" style={{ color: 'var(--flux-gold)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--flux-ink)' }}>实时频谱</span>
                </div>
                <canvas
                  ref={spectrumCanvasRef}
                  width={640}
                  height={120}
                  className="w-full"
                  style={{ background: 'var(--flux-marble-dark)' }}
                />
              </div>
            </div>

            {/* EQ Panel */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>Equalizer</span>
                  <h2 className="text-lg font-bold mt-1" style={{ color: 'var(--flux-ink)' }}>8 段网页 EQ</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(EQ_PRESETS).map((name) => (
                    <button
                      key={name}
                      onClick={() => applyPreset(name)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-md"
                      style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* EQ Sliders */}
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {BANDS.map((band, i) => (
                  <div key={band.freq} className="flex flex-col items-center gap-2 p-3 rounded-xl border"
                    style={{ borderColor: 'var(--flux-line)', background: 'rgba(255,255,255,0.5)' }}>
                    <span className="text-xs font-bold" style={{ color: 'var(--flux-ink-light)' }}>{band.label}</span>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="0.5"
                      value={eqGains[i]}
                      onChange={(e) => setBand(i, Number(e.target.value))}
                      className="h-20 md:h-24"
                      style={{ writingMode: 'vertical-lr', accentColor: 'var(--flux-gold)' }}
                    />
                    <output className="text-xs font-bold" style={{ color: 'var(--flux-ink)' }}>
                      {eqGains[i].toFixed(1).replace('.0', '')} dB
                    </output>
                  </div>
                ))}
              </div>

              {/* Fidelity row */}
              <div className="flex flex-wrap gap-4 mt-4 text-sm" style={{ color: 'var(--flux-ink-light)' }}>
                <label className="flex items-center gap-2">
                  <span>预增益</span>
                  <input
                    type="range"
                    min="-12"
                    max="6"
                    step="0.5"
                    value={preamp}
                    onChange={(e) => setPreamp(Number(e.target.value))}
                    className="w-24"
                    style={{ accentColor: 'var(--flux-gold)' }}
                  />
                  <span>{preamp} dB</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={limiterOn} onChange={(e) => setLimiterOn(e.target.checked)} className="accent-amber-600" />
                  <span>动态限幅</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={hifiMode} onChange={(e) => setHifiMode(e.target.checked)} className="accent-amber-600" />
                  <span>FLAC 保真模式</span>
                </label>
              </div>
            </div>

            {/* Track List (inline, for quick access) */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>Playlist</span>
                  <h2 className="text-lg font-bold mt-1" style={{ color: 'var(--flux-ink)' }}>获取音源</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePrev}
                    disabled={tracks.length === 0}
                    className="p-2 rounded-lg border transition-all disabled:opacity-30"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={togglePlay}
                    disabled={tracks.length === 0 && !audioRef.current?.src}
                    className="p-2 rounded-lg transition-all disabled:opacity-30"
                    style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={tracks.length === 0}
                    className="p-2 rounded-lg border transition-all disabled:opacity-30"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {tracks.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--flux-ink-light)' }}>
                  {loadingList ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> 正在读取音源...
                    </span>
                  ) : (
                    '暂无音源，请在右侧上传或配置 Worker API'
                  )}
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hidden">
                  {tracks.map((track, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentTrack(i);
                        setIsPlaying(true);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                        currentTrack === i
                          ? 'border-amber-500/30'
                          : 'border-transparent hover:border-[var(--flux-line)]'
                      }`}
                      style={currentTrack === i ? { background: 'rgba(212,175,55,0.08)' } : {}}
                    >
                      <span className="text-xs w-5 text-center font-bold" style={{ color: 'var(--flux-ink-light)' }}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--flux-ink)' }}>{track.title}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--flux-ink-light)' }}>{track.artist} {track.size ? `· ${formatSize(track.size)}` : ''}</p>
                      </div>
                      {currentTrack === i && isPlaying && (
                        <span className="flex gap-0.5">
                          <span className="w-0.5 h-4 rounded-full animate-bounce" style={{ background: 'var(--flux-gold)', animationDelay: '0ms' }} />
                          <span className="w-0.5 h-4 rounded-full animate-bounce" style={{ background: 'var(--flux-gold)', animationDelay: '150ms' }} />
                          <span className="w-0.5 h-4 rounded-full animate-bounce" style={{ background: 'var(--flux-gold)', animationDelay: '300ms' }} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - R2 Storage */}
          <div className="space-y-6">
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="mb-4">
                <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>R2 Storage</span>
                <h2 className="text-lg font-bold mt-1" style={{ color: 'var(--flux-ink)' }}>上传、下载与删除</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--flux-ink-light)' }}>Worker API</label>
                  <input
                    type="url"
                    value={workerApi}
                    onChange={(e) => {
                      setWorkerApi(e.target.value);
                      setStored('qcAudioApiBase', e.target.value);
                    }}
                    placeholder="https://your-worker.example.com"
                    className="w-full min-h-[2.5rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                    style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--flux-ink-light)' }}>公共下载根地址</label>
                  <input
                    type="url"
                    value={publicBase}
                    onChange={(e) => {
                      setPublicBase(e.target.value);
                      setStored('qcAudioPublicBase', e.target.value);
                    }}
                    className="w-full min-h-[2.5rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                    style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--flux-ink-light)' }}>开发者删除令牌</label>
                  <input
                    type="password"
                    value={devToken}
                    onChange={(e) => {
                      setDevToken(e.target.value);
                      setStored('qcAudioDevToken', e.target.value);
                    }}
                    placeholder="只保存在当前浏览器"
                    className="w-full min-h-[2.5rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                    style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--flux-ink-light)' }}>上传音源</label>
                  <input
                    type="file"
                    accept="audio/*,.flac"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFile(file);
                    }}
                    className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium"
                    style={{ color: 'var(--flux-ink-light)' }}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
                      const file = input?.files?.[0];
                      if (file) uploadFile(file);
                    }}
                    disabled={uploading}
                    className="flex-1 min-h-[2.5rem] rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    上传到 R2
                  </button>
                  <button
                    onClick={refreshList}
                    disabled={loadingList}
                    className="px-4 min-h-[2.5rem] rounded-lg text-sm font-medium border transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Storage status */}
                <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--flux-ink-light)' }}>
                  {storageStatus}
                </div>
              </div>
            </div>

            {/* R2 Object List */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--flux-ink)' }}>R2 对象列表</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hidden">
                {r2Objects.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: 'var(--flux-ink-light)' }}>暂无对象</p>
                ) : (
                  r2Objects.map((obj) => {
                    const name = obj.originalName || obj.key.split('/').pop() || obj.key;
                    const url = publicBase.replace(/\/+$/, '') + '/' + obj.key;
                    return (
                      <div key={obj.key} className="rounded-xl border p-3 transition-all hover:shadow-sm" style={{ borderColor: 'var(--flux-line)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--flux-ink)' }}>{name}</p>
                            <p className="text-xs" style={{ color: 'var(--flux-ink-light)' }}>{formatSize(obj.size)}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => loadUrl(url, name)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}
                          >
                            <Music className="w-3 h-3" /> 播放
                          </button>
                          <a
                            href={url}
                            download
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
                            style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}
                          >
                            <Download className="w-3 h-3" /> 下载
                          </a>
                          <button
                            onClick={() => deleteObject(obj.key)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                            style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}
                          >
                            <Trash2 className="w-3 h-3" /> 删除
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
