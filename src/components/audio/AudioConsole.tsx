import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Music,
  Pause,
  Play,
  Radio,
  RefreshCw,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Waves,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { globalAudio } from './audioStore';
import { drawResponseCurve, drawSpectrum } from './draw';
import { EQ_PRESETS, type EqBandConfig, FILTER_TYPES } from './engine';
import { useAudioEngine } from './useAudioEngine';
import { useAudioStore } from './useAudioStore';

/* ========== R2 Types ========== */
interface R2Object {
  key: string;
  size: number;
  uploaded: string;
  contentType?: string;
  originalName?: string;
}

/* ========== Helpers ========== */
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
    /* ignore */
  }
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
function parseFilename(name: string): { artist: string; title: string } {
  const clean = name.replace(/\.[^/.]+$/, '').trim();
  const sep = clean.indexOf(' - ');
  if (sep > 0) return { artist: clean.slice(0, sep).trim(), title: clean.slice(sep + 3).trim() };
  return { artist: 'Unknown', title: clean };
}

const SURROUND_PRESETS: Record<string, Record<string, number>> = {
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

/* ========== Component ========== */
export default function AudioConsole() {
  /* ---- Global audio store ---- */
  const { tracks, currentTrack, isPlaying, togglePlay, playTrack, setTracks, setIsPlaying } = useAudioStore();

  /* ---- Shared audio engine (single AudioContext for the whole site) ---- */
  const engine = useAudioEngine();
  const { getSpectrumData, getFilters } = engine;

  /* ---- Local state ---- */
  const [playerError, setPlayerError] = useState('');
  const [statusMsg, setStatusMsg] = useState('等待载入音源');
  const [showResponse, setShowResponse] = useState(true);

  /* ---- R2 state ---- */
  const [workerApi, setWorkerApi] = useState(getStored('qcAudioApiBase', DEFAULT_WORKER));
  const [publicBase, setPublicBase] = useState(getStored('qcAudioPublicBase', DEFAULT_PUBLIC_BASE));
  const [devToken, setDevToken] = useState(getStored('qcAudioDevToken', ''));
  const [storageStatus, setStorageStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [r2Objects, setR2Objects] = useState<R2Object[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  /* ---- Refs ---- */
  const spectrumInRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumOutRef = useRef<HTMLCanvasElement | null>(null);
  const responseRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const objectUrlRef = useRef<string | null>(null);

  /* Stable ref callback: attach the shared audio element exactly once.
     Must NOT re-run on re-renders — an inline ref re-invokes on every render
     and any state change here would reload (and stop) the playing audio. */
  const playerHostRef = useCallback((el: HTMLDivElement | null) => {
    if (el && globalAudio.parentElement !== el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
      globalAudio.controls = true;
      globalAudio.className = 'w-full mb-3';
      el.appendChild(globalAudio);
    }
  }, []);

  /* ========== Visualization ========== */
  useEffect(() => {
    const draw = () => {
      const { input, output } = getSpectrumData();
      drawSpectrum(spectrumInRef.current, input, ['#ed6ea0', '#e91e63']);
      drawSpectrum(spectrumOutRef.current, output, ['#57b5f2', '#2b7fd4']);
      if (showResponse) drawResponseCurve(responseRef.current, getFilters());
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [getSpectrumData, getFilters, showResponse]);

  /* ========== Player lifecycle ========== */
  useEffect(() => {
    const audio = globalAudio;
    const onLoaded = () => {
      setStatusMsg('已载入：' + decodeURIComponent(audio.currentSrc.split('/').pop() || ''));
      setPlayerError('');
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => audio.removeEventListener('loadedmetadata', onLoaded);
  }, []);

  useEffect(() => {
    return () => {
      // Detach globalAudio from the console DOM before React destroys it;
      // the detached element keeps playing on other pages.
      if (globalAudio.parentElement) {
        globalAudio.remove();
        globalAudio.controls = false;
        globalAudio.className = '';
        globalAudio.style.display = 'none';
        document.body.appendChild(globalAudio);
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetch the R2 list once on mount
  useEffect(() => {
    refreshList();
  }, []);

  /* ========== Handlers ========== */
  const loadUrl = useCallback(
    (url: string, label?: string) => {
      if (!url) {
        setStatusMsg('请输入可访问的音源 URL');
        return;
      }
      const name = label || new URL(url).pathname.split('/').pop() || 'Unknown';
      const { artist, title } = parseFilename(name);
      const newTrack = { title, artist, url: url.trim() };
      const newTracks = [newTrack, ...tracks];
      setTracks(newTracks);
      setIsPlaying(true);
      setStatusMsg('正在载入：' + title);
      globalAudio.src = newTrack.url;
      globalAudio.play().catch(() => setPlayerError('播放失败'));
    },
    [tracks, setTracks, setIsPlaying],
  );

  const loadLocalFile = useCallback(
    (file: File) => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      const { artist, title } = parseFilename(file.name);
      const newTrack = { title, artist, url, size: file.size };
      const newTracks = [newTrack, ...tracks];
      setTracks(newTracks);
      setIsPlaying(true);
      setStatusMsg('正在载入：' + file.name);
      globalAudio.src = newTrack.url;
      globalAudio.play().catch(() => setPlayerError('播放失败'));
    },
    [tracks, setTracks, setIsPlaying],
  );

  const handleTogglePlay = useCallback(() => {
    if (!globalAudio.src && tracks.length > 0) {
      playTrack(currentTrack);
      setStatusMsg('正在播放：' + tracks[currentTrack]?.title);
      return;
    }
    if (tracks.length === 0 && !globalAudio.src) return;
    togglePlay();
  }, [tracks, currentTrack, togglePlay, playTrack]);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    const next = (currentTrack + 1) % tracks.length;
    playTrack(next);
    setStatusMsg('正在播放：' + tracks[next]?.title);
  }, [tracks, currentTrack, playTrack]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    const prev = (currentTrack - 1 + tracks.length) % tracks.length;
    playTrack(prev);
    setStatusMsg('正在播放：' + tracks[prev]?.title);
  }, [tracks, currentTrack, playTrack]);

  const applyPreset = useCallback(
    (name: string) => {
      engine.applyPreset(name);
      setStatusMsg('已应用 EQ 预设：' + name);
    },
    [engine],
  );

  /* ---- R2 handlers ---- */
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
      const parsed = objects.map((obj) => {
        const name = obj.originalName || obj.key.split('/').pop() || obj.key;
        const { artist, title } = parseFilename(name);
        return { artist, title, url: publicBase.replace(/\/+$/, '') + '/' + obj.key, key: obj.key, size: obj.size };
      });
      setTracks(parsed);
      setStorageStatus(`已读取 ${objects.length} 个对象`);
    } catch (err: any) {
      setStorageStatus('列表读取失败：' + err.message);
    } finally {
      setLoadingList(false);
    }
  }, [workerApi, publicBase, setTracks]);

  const uploadFile = useCallback(
    async (file: File) => {
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
        const res = await fetch(api + '/api/audio/upload', { method: 'POST', body: form });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        setStorageStatus('上传完成：' + data.key);
        refreshList();
      } catch (err: any) {
        setStorageStatus('上传失败：' + err.message);
      } finally {
        setUploading(false);
      }
    },
    [workerApi, refreshList],
  );

  const deleteObject = useCallback(
    async (key: string) => {
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
    },
    [workerApi, devToken, refreshList],
  );

  /* ========== Render ========== */
  return (
    <div className="flex flex-col gap-6">
      {/* Intro */}
      <p className="text-muted-foreground text-sm leading-relaxed">
        面向 FLAC、WAV、MP3 与 OGG 的网页播放工作台。集成 10 段参数 EQ、差分环绕声处理、实时频谱与频率响应曲线；上传和列表通过
        Worker 接入 R2，删除需要开发者令牌。
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '公共下载域', value: 'r2.dev' },
          { label: '默认桶', value: 'r2-server' },
          { label: '删除权限', value: 'Developer' },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <span className="mb-1 block text-muted-foreground text-xs">{item.label}</span>
            <strong className="text-primary text-sm">{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Player Panel */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="font-bold text-primary text-xs uppercase tracking-widest">Playback</span>
                <h2 className="mt-1 font-bold text-lg">播放与解码</h2>
              </div>
              <button
                type="button"
                onClick={() => applyPreset('Flat')}
                className="rounded-lg border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted/60 hover:text-foreground"
              >
                重置 EQ
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <input
                type="url"
                placeholder="https://.../track.flac"
                className="min-h-[2.75rem] flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadUrl((e.target as HTMLInputElement).value);
                }}
              />
              <button
                type="button"
                onClick={(e) => loadUrl((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
                className="rounded-lg bg-primary px-4 font-medium text-primary-foreground text-sm transition-all hover:opacity-90"
              >
                载入并添加到列表
              </button>
            </div>

            <label className="mb-4 flex cursor-pointer flex-col gap-1 rounded-xl border border-primary/50 border-dashed bg-primary/5 p-4 transition-all hover:bg-primary/10">
              <input
                type="file"
                accept="audio/*,.flac"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadLocalFile(f);
                }}
              />
              <span className="font-medium text-sm">选择本地音源添加到播放列表</span>
              <span className="text-muted-foreground text-xs">本地文件不会上传，适合先检查 FLAC 兼容性和 EQ 效果</span>
            </label>

            <div ref={playerHostRef} />

            <div className="mb-4 rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
              {playerError ? (
                <span className="flex items-center gap-1.5 text-red-500">
                  <AlertCircle className="h-3.5 w-3.5" /> {playerError}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {statusMsg}
                </span>
              )}
            </div>

            {/* Dual Spectrum */}
            <div className="mb-4 overflow-hidden rounded-xl border border-border/60">
              <div className="flex items-center gap-2 border-border/60 border-b px-3 py-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-xs">输入频谱</span>
              </div>
              <canvas ref={spectrumInRef} width={800} height={100} className="audio-canvas w-full" />
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <div className="flex items-center gap-2 border-border/60 border-b px-3 py-2">
                <Waves className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-xs">输出频谱（EQ + 环绕处理后）</span>
              </div>
              <canvas ref={spectrumOutRef} width={800} height={100} className="audio-canvas w-full" />
            </div>
          </div>

          {/* Frequency Response */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-primary text-xs uppercase tracking-widest">Frequency Response</span>
                <h2 className="mt-1 font-bold text-lg">频率响应曲线</h2>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground text-xs">
                <input
                  type="checkbox"
                  checked={showResponse}
                  onChange={(e) => setShowResponse(e.target.checked)}
                  className="accent-primary"
                />
                显示曲线
              </label>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/60">
              <canvas ref={responseRef} width={800} height={160} className="audio-canvas w-full" />
            </div>
          </div>

          {/* EQ Panel */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-bold text-primary text-xs uppercase tracking-widest">Equalizer</span>
                <h2 className="mt-1 font-bold text-lg">10 段参数 EQ</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.keys(EQ_PRESETS).map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => applyPreset(name)}
                    className="rounded-lg border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted/60 hover:text-foreground"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* EQ Bands Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {engine.eqBands.map((band, i) => (
                <div
                  key={band.id}
                  className="rounded-xl border border-border/40 bg-muted/30 p-3 transition-all hover:shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-bold text-xs">{band.label}Hz</span>
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
                  <div className="flex items-center gap-2">
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
                    <span className="w-10 text-right font-mono text-primary text-xs">{band.gain.toFixed(1)}dB</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">Q</span>
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
                    <span className="w-10 text-right font-mono text-muted-foreground text-xs">{band.Q.toFixed(1)}</span>
                  </div>
                  {['lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'].includes(band.type) && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">f</span>
                      <input
                        type="range"
                        min={band.freq * 0.5}
                        max={Math.min(band.freq * 2, 20000)}
                        step="10"
                        value={band.freq}
                        onChange={(e) => engine.updateEqBand(i, { freq: Number(e.target.value) })}
                        className="flex-1"
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      <span className="w-10 text-right font-mono text-muted-foreground text-xs">
                        {band.freq >= 1000 ? (band.freq / 1000).toFixed(1) + 'k' : band.freq}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-muted-foreground text-sm">
              <label className="flex items-center gap-2">
                <span>预增益</span>
                <input
                  type="range"
                  min="-12"
                  max="6"
                  step="0.5"
                  value={engine.preamp}
                  onChange={(e) => engine.updatePreamp(Number(e.target.value))}
                  className="w-24"
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
                <span>{engine.preamp} dB</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={engine.limiterOn}
                  onChange={(e) => engine.updateLimiter(e.target.checked)}
                  className="accent-primary"
                />
                <span>动态限幅</span>
              </label>
            </div>
          </div>

          {/* Differential Surround Panel */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <div>
                  <span className="font-bold text-primary text-xs uppercase tracking-widest">Differential Surround</span>
                  <h2 className="mt-0.5 font-bold text-lg">差分环绕声处理</h2>
                </div>
              </div>
              <button
                type="button"
                disabled={engine.ready && !engine.surroundAvailable}
                title={engine.ready && !engine.surroundAvailable ? '当前浏览器不支持 AudioWorklet，环绕处理不可用' : undefined}
                onClick={() => engine.toggleSurroundState(!engine.surroundEnabled)}
                className={`rounded-lg px-4 py-2 font-medium text-sm transition-all disabled:cursor-not-allowed disabled:opacity-40 ${engine.surroundEnabled ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted/60'}`}
              >
                {engine.surroundEnabled ? '已启用' : '已关闭'}
              </button>
            </div>

            <p className="mb-4 text-muted-foreground text-xs">
              将立体声分解为和信号 M=(L+R)/2 与差信号 S=(L-R)/2。对 S 做高通去低频轰鸣、低通去高频串扰，再加 Haas
              延迟后反相混合到左右声道，产生虚拟环绕声场。
            </p>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { key: 'centerGain', label: 'Center 增益', min: 0, max: 2, step: 0.01, unit: '' },
                { key: 'surroundWidth', label: 'Surround 宽度', min: 0, max: 2, step: 0.01, unit: '' },
                { key: 'hpFreq', label: '高通截止', min: 20, max: 1000, step: 10, unit: 'Hz' },
                { key: 'lpFreq', label: '低通截止', min: 1000, max: 16000, step: 100, unit: 'Hz' },
                { key: 'eqGain', label: '环绕 EQ 增益', min: -12, max: 12, step: 0.5, unit: 'dB' },
                { key: 'delayTime', label: '延迟时间', min: 0, max: 50, step: 0.5, unit: 'ms' },
                { key: 'surroundGain', label: '环绕增益', min: 0, max: 2, step: 0.01, unit: '' },
                { key: 'outputGain', label: '总输出增益', min: 0, max: 2, step: 0.01, unit: '' },
              ].map((p) => (
                <div key={p.key} className="rounded-xl border border-border/40 bg-muted/30 p-3">
                  <div className="mb-1 flex justify-between text-muted-foreground text-xs">
                    <span>{p.label}</span>
                    <span className="font-mono text-primary">
                      {p.unit === 'Hz'
                        ? Math.round(engine.surroundParams[p.key as keyof typeof engine.surroundParams]) + 'Hz'
                        : p.unit === 'dB'
                          ? (engine.surroundParams[p.key as keyof typeof engine.surroundParams] as number).toFixed(1) + 'dB'
                          : p.unit === 'ms'
                            ? (engine.surroundParams[p.key as keyof typeof engine.surroundParams] as number).toFixed(1) + 'ms'
                            : (engine.surroundParams[p.key as keyof typeof engine.surroundParams] as number).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={engine.surroundParams[p.key as keyof typeof engine.surroundParams]}
                    onChange={(e) =>
                      engine.updateSurroundParam(p.key as keyof typeof engine.surroundParams, Number(e.target.value))
                    }
                    className="w-full"
                    style={{ accentColor: 'hsl(var(--primary))' }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { name: 'music', label: '🎵 音乐' },
                { name: 'movie', label: '🎬 电影' },
                { name: 'voice', label: '🗣️ 语音' },
                { name: 'wide', label: '↔️ 超宽' },
              ].map((p) => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => {
                    const preset = SURROUND_PRESETS[p.name];
                    if (preset) {
                      engine.updateSurroundParams(preset);
                      engine.toggleSurroundState(true);
                      setStatusMsg('已加载环绕预设: ' + p.label);
                    }
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted/60 hover:text-foreground"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Track List */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="font-bold text-primary text-xs uppercase tracking-widest">Playlist</span>
                <h2 className="mt-1 font-bold text-lg">获取音源</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={tracks.length === 0}
                  className="rounded-lg border border-border p-2 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground disabled:opacity-30"
                >
                  <SkipBack className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  disabled={tracks.length === 0 && !globalAudio.src}
                  className="rounded-lg bg-primary p-2 text-primary-foreground transition-all hover:opacity-90 disabled:opacity-30"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={tracks.length === 0}
                  className="rounded-lg border border-border p-2 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground disabled:opacity-30"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            </div>

            {tracks.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                {loadingList ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> 正在读取音源...
                  </span>
                ) : (
                  '暂无音源，请在右侧上传或配置 Worker API'
                )}
              </p>
            ) : (
              <div className="scrollbar-hidden max-h-80 space-y-2 overflow-y-auto">
                {tracks.map((track, i) => (
                  <button
                    type="button"
                    key={track.url || `track-${i}`}
                    onClick={() => {
                      if (!track.url) return;
                      globalAudio.src = track.url;
                      setIsPlaying(true);
                      setStatusMsg('正在播放：' + track.title);
                      globalAudio.play().catch(() => setPlayerError('播放失败'));
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${currentTrack === i ? 'border-primary/30 bg-primary/10' : 'border-transparent hover:border-border'}`}
                  >
                    <span className="w-5 text-center font-bold text-muted-foreground text-xs">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium text-sm ${currentTrack === i ? 'text-primary' : ''}`}>
                        {track.title}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {track.artist} {track.size ? `· ${formatSize(track.size)}` : ''}
                      </p>
                    </div>
                    {currentTrack === i && isPlaying && (
                      <span className="flex gap-0.5">
                        <span className="h-4 w-0.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
                        <span
                          className="h-4 w-0.5 animate-bounce rounded-full bg-primary"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="h-4 w-0.5 animate-bounce rounded-full bg-primary"
                          style={{ animationDelay: '300ms' }}
                        />
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
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <div className="mb-4">
              <span className="font-bold text-primary text-xs uppercase tracking-widest">R2 Storage</span>
              <h2 className="mt-1 font-bold text-lg">上传、下载与删除</h2>
            </div>
            <div className="space-y-4">
              <div>
                <span className="mb-1.5 block font-bold text-muted-foreground text-xs">Worker API</span>
                <input
                  type="url"
                  value={workerApi}
                  onChange={(e) => {
                    setWorkerApi(e.target.value);
                    setStored('qcAudioApiBase', e.target.value);
                  }}
                  placeholder="https://your-worker.example.com"
                  className="min-h-[2.5rem] w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <span className="mb-1.5 block font-bold text-muted-foreground text-xs">公共下载根地址</span>
                <input
                  type="url"
                  value={publicBase}
                  onChange={(e) => {
                    setPublicBase(e.target.value);
                    setStored('qcAudioPublicBase', e.target.value);
                  }}
                  className="min-h-[2.5rem] w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <span className="mb-1.5 block font-bold text-muted-foreground text-xs">开发者删除令牌</span>
                <input
                  type="password"
                  value={devToken}
                  onChange={(e) => {
                    setDevToken(e.target.value);
                    setStored('qcAudioDevToken', e.target.value);
                  }}
                  placeholder="只保存在当前浏览器"
                  className="min-h-[2.5rem] w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-all focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <span className="mb-1.5 block font-bold text-muted-foreground text-xs">上传音源</span>
                <input
                  type="file"
                  accept="audio/*,.flac"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadFile(f);
                  }}
                  className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:font-medium file:text-primary-foreground file:text-sm"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
                    const file = input?.files?.[0];
                    if (file) uploadFile(file);
                  }}
                  disabled={uploading}
                  className="flex min-h-[2.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary font-medium text-primary-foreground text-sm transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  上传到 R2
                </button>
                <button
                  type="button"
                  onClick={refreshList}
                  disabled={loadingList}
                  className="flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-lg border border-border px-4 font-medium text-muted-foreground text-sm transition-all hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-muted-foreground text-xs">{storageStatus}</div>
            </div>
          </div>

          {/* R2 Object List */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
            <h3 className="mb-3 font-bold text-sm">R2 对象列表</h3>
            <div className="scrollbar-hidden max-h-96 space-y-2 overflow-y-auto">
              {r2Objects.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground text-xs">暂无对象</p>
              ) : (
                r2Objects.map((obj) => {
                  const name = obj.originalName || obj.key.split('/').pop() || obj.key;
                  const url = publicBase.replace(/\/+$/, '') + '/' + obj.key;
                  return (
                    <div key={obj.key} className="rounded-xl border border-border/40 p-3 transition-all hover:shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-sm">{name}</p>
                          <p className="text-muted-foreground text-xs">{formatSize(obj.size)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => loadUrl(url, name)}
                          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 font-medium text-primary-foreground text-xs transition-all hover:opacity-90"
                        >
                          <Music className="h-3 w-3" /> 播放
                        </button>
                        <a
                          href={url}
                          download
                          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted/60 hover:text-foreground"
                        >
                          <Download className="h-3 w-3" /> 下载
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteObject(obj.key)}
                          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" /> 删除
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
  );
}
