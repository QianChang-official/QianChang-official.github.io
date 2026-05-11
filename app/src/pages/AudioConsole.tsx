import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Upload, RefreshCw,
  Trash2, Download, Music, Loader2, AlertCircle, CheckCircle2,
  Radio, Activity, Waves
} from 'lucide-react';
import { useAudioStore } from '@/hooks/useAudioStore';
import { globalAudio } from '@/stores/audioStore';

/* ========== R2 Types ========== */
interface R2Object {
  key: string;
  size: number;
  uploaded: string;
  contentType?: string;
  originalName?: string;
}

/* ========== EQ Types ========== */
interface EqBandConfig {
  id: number;
  label: string;
  freq: number;
  gain: number;
  Q: number;
  type: BiquadFilterType;
}

const FILTER_TYPES: BiquadFilterType[] = ['peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'];

const DEFAULT_EQ: EqBandConfig[] = [
  { id: 0, label: '31', freq: 31, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 1, label: '63', freq: 63, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 2, label: '125', freq: 125, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 3, label: '250', freq: 250, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 4, label: '500', freq: 500, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 5, label: '1k', freq: 1000, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 6, label: '2k', freq: 2000, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 7, label: '4k', freq: 4000, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 8, label: '8k', freq: 8000, gain: 0, Q: 1.05, type: 'peaking' },
  { id: 9, label: '16k', freq: 16000, gain: 0, Q: 1.05, type: 'peaking' },
];

const EQ_PRESETS: Record<string, Partial<EqBandConfig>[]> = {
  Flat: DEFAULT_EQ.map(b => ({ ...b, gain: 0 })),
  'FLAC Warm': [
    { gain: 2, type: 'lowshelf' }, { gain: 1.5 }, { gain: 1 }, { gain: 0.5 },
    { gain: 0 }, { gain: 0 }, { gain: 0.5 }, { gain: 1 }, { gain: 1.5 }, { gain: 2, type: 'highshelf' }
  ],
  Vocal: [
    { gain: -2 }, { gain: -1.5 }, { gain: -1 }, { gain: 0.5 }, { gain: 2 },
    { gain: 2.5 }, { gain: 1.5 }, { gain: 0.5 }, { gain: -0.5 }, { gain: -1 }
  ],
  Bass: [
    { gain: 5, type: 'lowshelf', Q: 1.4 }, { gain: 4 }, { gain: 2.5 }, { gain: 1 },
    { gain: 0 }, { gain: -0.5 }, { gain: -0.5 }, { gain: 0 }, { gain: 0 }, { gain: 0 }
  ],
  Bright: [
    { gain: -1 }, { gain: -1 }, { gain: -0.5 }, { gain: 0 }, { gain: 0.5 },
    { gain: 1.5 }, { gain: 2.5 }, { gain: 3.5 }, { gain: 4 }, { gain: 3, type: 'highshelf' }
  ],
  'Surround+Vocal': [
    { gain: 1, type: 'lowshelf' }, { gain: 0.5 }, { gain: 0 }, { gain: 1 }, { gain: 2.5 },
    { gain: 2 }, { gain: 1 }, { gain: 0.5 }, { gain: 1 }, { gain: 1.5, type: 'highshelf' }
  ],
};

/* ========== Surround Worklet ========== */
const SURROUND_WORKLET = `
class DifferentialSurroundProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.delayBuf = new Float32Array(48000);
    this.delayWrite = 0;
    this.lpX1=0;this.lpX2=0;this.lpY1=0;this.lpY2=0;
    this.hpX1=0;this.hpX2=0;this.hpY1=0;this.hpY2=0;
  }
  static get parameterDescriptors() {
    return [
      {name:'centerGain',   defaultValue:1,   minValue:0, maxValue:2, automationRate:'k-rate'},
      {name:'surroundWidth',defaultValue:1,   minValue:0, maxValue:2, automationRate:'k-rate'},
      {name:'lpFreq',       defaultValue:7000, minValue:200, maxValue:20000, automationRate:'k-rate'},
      {name:'hpFreq',       defaultValue:200,  minValue:20,  maxValue:2000,  automationRate:'k-rate'},
      {name:'eqGain',       defaultValue:0,    minValue:-12, maxValue:12, automationRate:'k-rate'},
      {name:'delayTime',    defaultValue:20,   minValue:0,   maxValue:50, automationRate:'k-rate'},
      {name:'surroundGain', defaultValue:1,    minValue:0,   maxValue:2, automationRate:'k-rate'},
      {name:'outputGain',   defaultValue:0.8,  minValue:0,   maxValue:2, automationRate:'k-rate'},
      {name:'bypass',       defaultValue:1,    minValue:0,   maxValue:1, automationRate:'k-rate'}
    ];
  }
  calcLPF(fc, fs, Q=0.707) {
    const w0=2*Math.PI*fc/fs; const cos=Math.cos(w0), sin=Math.sin(w0);
    const alpha=sin/(2*Q); const a0=1+alpha;
    return {
      b0:(1-cos)/2/a0, b1:(1-cos)/a0, b2:(1-cos)/2/a0,
      a1:-2*cos/a0, a2:(1-alpha)/a0
    };
  }
  calcHPF(fc, fs, Q=0.707) {
    const w0=2*Math.PI*fc/fs; const cos=Math.cos(w0), sin=Math.sin(w0);
    const alpha=sin/(2*Q); const a0=1+alpha;
    return {
      b0:(1+cos)/2/a0, b1:-(1+cos)/a0, b2:(1+cos)/2/a0,
      a1:-2*cos/a0, a2:(1-alpha)/a0
    };
  }
  process(inputs, outputs, parameters) {
    const inp=inputs[0], out=outputs[0];
    if(!inp||!inp[0]||!inp[1]) return true;
    const L=inp[0], R=inp[1], OL=out[0], OR=out[1];
    const cGain=parameters.centerGain[0], sWidth=parameters.surroundWidth[0];
    const lpF=parameters.lpFreq[0], hpF=parameters.hpFreq[0];
    const eqG=Math.pow(10, parameters.eqGain[0]/20);
    const dlyMs=parameters.delayTime[0], sGain=parameters.surroundGain[0];
    const outG=parameters.outputGain[0], bypass=parameters.bypass[0]>0.5;
    const dlySamples=Math.max(0, Math.floor(dlyMs*sampleRate/1000));
    const lpC=this.calcLPF(lpF, sampleRate), hpC=this.calcHPF(hpF, sampleRate);

    for(let i=0;i<L.length;i++){
      const l=L[i], r=R[i];
      if(bypass){ OL[i]=l*outG; OR[i]=r*outG; continue; }
      const C=(l+r)*0.5*cGain, S=(l-r)*0.5*sWidth;

      const hy=hpC.b0*S+hpC.b1*this.hpX1+hpC.b2*this.hpX2-hpC.a1*this.hpY1-hpC.a2*this.hpY2;
      this.hpX2=this.hpX1; this.hpX1=S; this.hpY2=this.hpY1; this.hpY1=hy;

      const ly_=lpC.b0*hy+lpC.b1*this.lpX1+lpC.b2*this.lpX2-lpC.a1*this.lpY1-lpC.a2*this.lpY2;
      this.lpX2=this.lpX1; this.lpX1=hy; this.lpY2=this.lpY1; this.lpY1=ly_;

      const filteredS=ly_*eqG;
      const readIdx=(this.delayWrite-dlySamples+this.delayBuf.length)%this.delayBuf.length;
      const delayedS=dlySamples>0?this.delayBuf[readIdx]:filteredS;
      this.delayBuf[this.delayWrite]=filteredS;
      this.delayWrite=(this.delayWrite+1)%this.delayBuf.length;

      const wet=delayedS*sGain;
      OL[i]=(C+wet)*outG; OR[i]=(C-wet)*outG;
    }
    return true;
  }
}
registerProcessor('differential-surround', DifferentialSurroundProcessor);
`;

/* ========== Helpers ========== */
const DEFAULT_WORKER = 'https://qianchang-r2-audio.3174837085.workers.dev';
const DEFAULT_PUBLIC_BASE = 'https://pub-ae8ff9e688d7481da1eab0ed3dd2a2fd.r2.dev';

function getStored(key: string, fallback = '') {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; }
}
function setStored(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}
function formatSize(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return size.toFixed(unit ? 1 : 0) + ' ' + units[unit];
}
function parseFilename(name: string): { artist: string; title: string } {
  const clean = name.replace(/\.[^/.]+$/, '').trim();
  const sep = clean.indexOf(' - ');
  if (sep > 0) return { artist: clean.slice(0, sep).trim(), title: clean.slice(sep + 3).trim() };
  return { artist: 'Unknown', title: clean };
}

function loadTrackUrl(url: string, label?: string): { artist: string; title: string; url: string } {
  const displayName = label || new URL(url).pathname.split('/').pop() || 'Unknown';
  const parsedLabel = parseFilename(displayName);
  return {
    title: parsedLabel.title,
    artist: parsedLabel.artist,
    url: url.trim()
  };
}

/* ========== Component ========== */
export default function AudioConsole() {
  /* ---- Global audio store ---- */
  const {
    tracks, currentTrack, isPlaying, togglePlay, playTrack, setTracks, setIsPlaying,
  } = useAudioStore();

  /* ---- Local state ---- */
  const [playerError, setPlayerError] = useState('');
  const [statusMsg, setStatusMsg] = useState('等待载入音源');

  /* ---- EQ state ---- */
  const [eqBands, setEqBands] = useState<EqBandConfig[]>(JSON.parse(JSON.stringify(DEFAULT_EQ)));
  const [preamp, setPreamp] = useState(-1);
  const [limiterOn, setLimiterOn] = useState(true);
  const [showResponse, setShowResponse] = useState(true);

  /* ---- Surround state ---- */
  const [surroundEnabled, setSurroundEnabled] = useState(false);
  const [surroundParams, setSurroundParams] = useState({
    centerGain: 1, surroundWidth: 1, lpFreq: 7000, hpFreq: 200,
    eqGain: 0, delayTime: 20, surroundGain: 1, outputGain: 0.8,
  });

  /* ---- R2 state ---- */
  const [workerApi, setWorkerApi] = useState(getStored('qcAudioApiBase', DEFAULT_WORKER));
  const [publicBase, setPublicBase] = useState(getStored('qcAudioPublicBase', DEFAULT_PUBLIC_BASE));
  const [devToken, setDevToken] = useState(getStored('qcAudioDevToken', ''));
  const [storageStatus, setStorageStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [r2Objects, setR2Objects] = useState<R2Object[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  /* ---- Refs ---- */
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const surroundRef = useRef<AudioWorkletNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const preampRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserInRef = useRef<AnalyserNode | null>(null);
  const analyserOutRef = useRef<AnalyserNode | null>(null);
  const spectrumInRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumOutRef = useRef<HTMLCanvasElement | null>(null);
  const responseRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const objectUrlRef = useRef<string | null>(null);
  const graphReadyRef = useRef(false);

  // Mutable refs for audio graph (avoid re-creating initGraph on every slider move)
  const eqBandsRef = useRef<EqBandConfig[]>(JSON.parse(JSON.stringify(DEFAULT_EQ)));
  const preampRefValue = useRef(-1);
  const limiterOnRefValue = useRef(true);

  // Sync state → refs
  useEffect(() => { eqBandsRef.current = eqBands; }, [eqBands]);
  useEffect(() => { preampRefValue.current = preamp; }, [preamp]);
  useEffect(() => { limiterOnRefValue.current = limiterOn; }, [limiterOn]);

  /* ========== Audio Graph ========== */
  const initGraph = useCallback(async () => {
    if (graphReadyRef.current) return;
    const audio = globalAudio;
    if (!audio) return;

    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) { setStatusMsg('当前浏览器不支持 Web Audio API'); return; }

    // Reuse existing AudioContext if available (user may have left and returned)
    let ctx = audioCtxRef.current;
    if (!ctx) {
      ctx = new AudioContext();
      audioCtxRef.current = ctx;
    }

    // Reuse or create MediaElementAudioSourceNode
    // Note: can only create once per audio element per AudioContext
    let source = sourceRef.current;
    if (!source) {
      source = ctx.createMediaElementSource(audio);
      sourceRef.current = source;
      // Bypass path: source → destination ensures audio keeps playing when leaving page
      source.connect(ctx.destination);
    }

    // Register surround worklet
    try {
      const blob = new Blob([SURROUND_WORKLET], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
    } catch {
      setStatusMsg('AudioWorklet 注册失败，环绕功能不可用');
    }

    const surround = new AudioWorkletNode(ctx, 'differential-surround', { outputChannelCount: [2] });
    surround.parameters.get('bypass')?.setValueAtTime(1, ctx.currentTime);
    surroundRef.current = surround;

    const aIn = ctx.createAnalyser(); aIn.fftSize = 2048;
    const aOut = ctx.createAnalyser(); aOut.fftSize = 2048;
    analyserInRef.current = aIn;
    analyserOutRef.current = aOut;

    const pre = ctx.createGain();
    pre.gain.value = Math.pow(10, preampRefValue.current / 20);
    preampRef.current = pre;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = limiterOnRefValue.current ? -4 : 0;
    comp.knee.value = 10;
    comp.ratio.value = limiterOnRefValue.current ? 6 : 1;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;
    compressorRef.current = comp;

    // Build EQ chain
    const currentBands = eqBandsRef.current;
    filtersRef.current = currentBands.map(b => {
      const f = ctx.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.freq;
      f.gain.value = b.gain;
      f.Q.value = b.Q;
      return f;
    });

    // Connect processed path: source → analyserIn → surround → EQ → preamp → compressor → analyserOut → destination
    source.connect(aIn);
    aIn.connect(surround);

    let prev: AudioNode = surround;
    filtersRef.current.forEach(filter => {
      prev.connect(filter);
      prev = filter;
    });
    prev.connect(pre);
    pre.connect(comp);
    comp.connect(aOut);
    aOut.connect(ctx.destination);

    graphReadyRef.current = true;
  }, [surroundEnabled]);

  /* ---- Update EQ params ---- */
  useEffect(() => {
    filtersRef.current.forEach((f, i) => {
      if (!f) return;
      const b = eqBands[i];
      f.type = b.type;
      f.frequency.value = b.freq;
      f.gain.value = b.gain;
      f.Q.value = b.Q;
    });
  }, [eqBands]);

  /* ---- Update surround params ---- */
  useEffect(() => {
    const node = surroundRef.current;
    const ctx = audioCtxRef.current;
    if (!node || !ctx) return;
    node.parameters.get('centerGain')?.setValueAtTime(surroundParams.centerGain, ctx.currentTime);
    node.parameters.get('surroundWidth')?.setValueAtTime(surroundParams.surroundWidth, ctx.currentTime);
    node.parameters.get('lpFreq')?.setValueAtTime(surroundParams.lpFreq, ctx.currentTime);
    node.parameters.get('hpFreq')?.setValueAtTime(surroundParams.hpFreq, ctx.currentTime);
    node.parameters.get('eqGain')?.setValueAtTime(surroundParams.eqGain, ctx.currentTime);
    node.parameters.get('delayTime')?.setValueAtTime(surroundParams.delayTime, ctx.currentTime);
    node.parameters.get('surroundGain')?.setValueAtTime(surroundParams.surroundGain, ctx.currentTime);
    node.parameters.get('outputGain')?.setValueAtTime(surroundParams.outputGain, ctx.currentTime);
    node.parameters.get('bypass')?.setValueAtTime(surroundEnabled ? 0 : 1, ctx.currentTime);
  }, [surroundParams, surroundEnabled]);

  /* ---- Update preamp / limiter ---- */
  useEffect(() => {
    if (preampRef.current) preampRef.current.gain.value = Math.pow(10, preamp / 20);
  }, [preamp]);
  useEffect(() => {
    if (compressorRef.current) {
      compressorRef.current.threshold.value = limiterOn ? -4 : 0;
      compressorRef.current.ratio.value = limiterOn ? 6 : 1;
    }
  }, [limiterOn]);

  /* ========== Visualization ========== */
  useEffect(() => {
    const draw = () => {
      drawSpectrum(spectrumInRef.current, analyserInRef.current, '#d4af37', '#b8960c');
      drawSpectrum(spectrumOutRef.current, analyserOutRef.current, '#00d2ff', '#3a7bd5');
      drawResponseCurve(responseRef.current, filtersRef.current);
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  /* ========== Player lifecycle ========== */
  useEffect(() => {
    const audio = globalAudio;

    const onPlay = () => { initGraph(); if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume(); };
    const onLoaded = () => { setStatusMsg('已载入：' + decodeURIComponent(audio.currentSrc.split('/').pop() || '')); setPlayerError(''); };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('loadedmetadata', onLoaded);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [initGraph]);

  // If audio is already playing when mounting (user returned from another page),
  // init graph immediately so EQ/surround works
  useEffect(() => {
    if (!globalAudio.paused && globalAudio.src) {
      initGraph();
    }
  }, [initGraph]);

  useEffect(() => {
    return () => {
      // Detach globalAudio from AudioConsole DOM before React destroys it
      if (globalAudio.parentElement) {
        globalAudio.remove();
        globalAudio.controls = false;
        globalAudio.className = '';
        globalAudio.style.display = 'none';
        document.body.appendChild(globalAudio);
      }
      // Don't close AudioContext or nullify sourceRef - we need to reuse them
      // when user returns to this page so audio keeps playing
      surroundRef.current = null;
      filtersRef.current = [];
      analyserInRef.current = null;
      analyserOutRef.current = null;
      graphReadyRef.current = false;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  useEffect(() => { refreshList(); }, []);

  /* ========== Handlers ========== */
  const loadUrl = useCallback((url: string, label?: string) => {
    if (!url) { setStatusMsg('请输入可访问的音源 URL'); return; }
    const name = label || new URL(url).pathname.split('/').pop() || 'Unknown';
    const { artist, title } = parseFilename(name);
    const newTrack = { title, artist, url: url.trim() };
    const newTracks = [newTrack, ...tracks];
    setTracks(newTracks);
    setIsPlaying(true);
    setStatusMsg('正在载入：' + title);
    globalAudio.src = newTrack.url;
    globalAudio.play().catch(() => setPlayerError('播放失败'));
  }, [tracks, setTracks, setIsPlaying]);

  const loadLocalFile = useCallback((file: File) => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file); objectUrlRef.current = url;
    const { artist, title } = parseFilename(file.name);
    const newTrack = { title, artist, url, size: file.size };
    const newTracks = [newTrack, ...tracks];
    setTracks(newTracks);
    setIsPlaying(true);
    setStatusMsg('正在载入：' + file.name);
    globalAudio.src = newTrack.url;
    globalAudio.play().catch(() => setPlayerError('播放失败'));
  }, [tracks, setTracks, setIsPlaying]);

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

  const setBand = useCallback((index: number, patch: Partial<EqBandConfig>) => {
    setEqBands(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      const f = filtersRef.current[index];
      if (f) {
        if (patch.type !== undefined) f.type = patch.type;
        if (patch.freq !== undefined) f.frequency.value = patch.freq;
        if (patch.gain !== undefined) f.gain.value = patch.gain;
        if (patch.Q !== undefined) f.Q.value = patch.Q;
      }
      return next;
    });
  }, []);

  const applyPreset = useCallback((name: string) => {
    const preset = EQ_PRESETS[name];
    if (!preset) return;
    setEqBands(prev => prev.map((b, i) => {
      const p = preset[i];
      if (!p) return b;
      const next = { ...b, ...p };
      const f = filtersRef.current[i];
      if (f) {
        if (p.type) f.type = p.type;
        if (p.freq) f.frequency.value = p.freq;
        if (p.gain !== undefined) f.gain.value = p.gain;
        if (p.Q) f.Q.value = p.Q;
      }
      return next;
    }));
    setStatusMsg('已应用 EQ 预设：' + name);
  }, []);

  /* ---- Surround handlers ---- */
  const setSurroundParam = useCallback((key: string, val: number) => {
    setSurroundParams(prev => ({ ...prev, [key]: val }));
  }, []);

  /* ---- R2 handlers ---- */
  const refreshList = useCallback(async () => {
    const api = workerApi.replace(/\/+$/, '');
    if (!api) { setStorageStatus('请先填写 Worker API 地址'); return; }
    setLoadingList(true); setStorageStatus('正在读取 R2 列表...');
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
      setStorageStatus(`已读取 ${objects.length} 个对象`);
    } catch (err: any) { setStorageStatus('列表读取失败：' + err.message); }
    finally { setLoadingList(false); }
  }, [workerApi, publicBase]);

  const uploadFile = useCallback(async (file: File) => {
    const api = workerApi.replace(/\/+$/, '');
    if (!api) { setStorageStatus('请先填写 Worker API 地址'); return; }
    if (!file) { setStorageStatus('请选择要上传的音源文件'); return; }
    if (file.size > 90 * 1024 * 1024) { setStorageStatus('文件超过 90MB 限制'); return; }
    setUploading(true); setStorageStatus('正在上传：' + file.name);
    try {
      const form = new FormData(); form.append('file', file);
      const res = await fetch(api + '/api/audio/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setStorageStatus('上传完成：' + data.key); refreshList();
    } catch (err: any) { setStorageStatus('上传失败：' + err.message); }
    finally { setUploading(false); }
  }, [workerApi, refreshList]);

  const deleteObject = useCallback(async (key: string) => {
    const api = workerApi.replace(/\/+$/, '');
    if (!devToken) { setStorageStatus('删除需要开发者令牌'); return; }
    setStorageStatus('正在删除...');
    try {
      const res = await fetch(api + '/api/audio/delete?key=' + encodeURIComponent(key), {
        method: 'DELETE', headers: { 'x-developer-key': devToken }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStorageStatus('已删除：' + key); refreshList();
    } catch (err: any) { setStorageStatus('删除失败：' + err.message); }
  }, [workerApi, devToken, refreshList]);

  /* ========== Render ========== */
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
            面向 FLAC、WAV、MP3 与 OGG 的网页播放工作台。集成 10 段参数 EQ、差分环绕声处理、实时频谱与频率响应曲线；上传和列表通过 Worker 接入 R2，删除需要开发者令牌。
          </p>
          <div className="grid grid-cols-3 gap-3 mt-6 max-w-lg">
            {[{ label: '公共下载域', value: 'r2.dev' }, { label: '默认桶', value: 'r2-server' }, { label: '删除权限', value: 'Developer' }].map(item => (
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
                <button onClick={() => applyPreset('Flat')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-md"
                  style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                  重置 EQ
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <input type="url" placeholder="https://.../track.flac"
                  className="flex-1 min-h-[2.75rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                  style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }}
                  onKeyDown={e => { if (e.key === 'Enter') loadUrl((e.target as HTMLInputElement).value); }} />
                <button onClick={e => loadUrl((e.currentTarget.previousElementSibling as HTMLInputElement).value)}
                  className="px-4 rounded-lg text-sm font-medium transition-all" style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}>
                  载入并添加到列表
                </button>
              </div>

              <label className="flex flex-col gap-1 mb-4 p-4 rounded-xl border border-dashed cursor-pointer transition-all hover:opacity-80"
                style={{ borderColor: 'var(--flux-gold)', background: 'rgba(212,175,55,0.05)' }}>
                <input type="file" accept="audio/*,.flac" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) loadLocalFile(f); }} />
                <span className="text-sm font-medium" style={{ color: 'var(--flux-ink)' }}>选择本地音源添加到播放列表</span>
                <span className="text-xs" style={{ color: 'var(--flux-ink-light)' }}>本地文件不会上传，适合先检查 FLAC 兼容性和 EQ 效果</span>
              </label>

              <div ref={el => {
                if (el && globalAudio.parentElement !== el) {
                  // Clear existing element first
                  while (el.firstChild) {
                    el.removeChild(el.firstChild);
                  }
                  globalAudio.controls = true;
                  globalAudio.className = 'w-full mb-3';
                  el.appendChild(globalAudio);
                } else if (el && globalAudio.parentElement === el) {
                  // Update src when source changes
                  globalAudio.load();
                }
              }} />

              <div className="rounded-lg px-3 py-2 text-sm mb-4" style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--flux-ink-light)' }}>
                {playerError ? (
                  <span className="flex items-center gap-1.5 text-red-500"><AlertCircle className="w-3.5 h-3.5" /> {playerError}</span>
                ) : (
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--flux-gold)' }} /> {statusMsg}</span>
                )}
              </div>

              {/* Dual Spectrum */}
              <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: 'var(--flux-line)' }}>
                <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--flux-line)' }}>
                  <Activity className="w-3.5 h-3.5" style={{ color: 'var(--flux-gold)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--flux-ink)' }}>输入频谱</span>
                </div>
                <canvas ref={spectrumInRef} width={800} height={100} className="w-full" style={{ background: 'var(--flux-marble-dark)' }} />
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--flux-line)' }}>
                <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--flux-line)' }}>
                  <Waves className="w-3.5 h-3.5" style={{ color: 'var(--flux-gold)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--flux-ink)' }}>输出频谱（EQ + 环绕处理后）</span>
                </div>
                <canvas ref={spectrumOutRef} width={800} height={100} className="w-full" style={{ background: 'var(--flux-marble-dark)' }} />
              </div>
            </div>

            {/* Frequency Response */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>Frequency Response</span>
                  <h2 className="text-lg font-bold mt-1" style={{ color: 'var(--flux-ink)' }}>频率响应曲线</h2>
                </div>
                <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--flux-ink-light)' }}>
                  <input type="checkbox" checked={showResponse} onChange={e => setShowResponse(e.target.checked)} className="accent-amber-600" />
                  显示曲线
                </label>
              </div>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--flux-line)' }}>
                <canvas ref={responseRef} width={800} height={160} className="w-full" style={{ background: 'var(--flux-marble-dark)' }} />
              </div>
            </div>

            {/* EQ Panel */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>Equalizer</span>
                  <h2 className="text-lg font-bold mt-1" style={{ color: 'var(--flux-ink)' }}>10 段参数 EQ</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(EQ_PRESETS).map(name => (
                    <button key={name} onClick={() => applyPreset(name)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:shadow-md"
                      style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* EQ Bands Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {eqBands.map((band, i) => (
                  <div key={band.id} className="rounded-xl border p-3 transition-all hover:shadow-sm" style={{ borderColor: 'var(--flux-line)', background: 'rgba(255,255,255,0.5)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--flux-ink)' }}>{band.label}Hz</span>
                      <select value={band.type} onChange={e => setBand(i, { type: e.target.value as BiquadFilterType })}
                        className="text-xs rounded border px-1 py-0.5 outline-none" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)', color: 'var(--flux-ink)' }}>
                        {FILTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="range" min="-12" max="12" step="0.5" value={band.gain}
                        onChange={e => setBand(i, { gain: Number(e.target.value) })}
                        className="flex-1" style={{ accentColor: 'var(--flux-gold)' }} />
                      <span className="text-xs font-mono w-10 text-right" style={{ color: 'var(--flux-gold)' }}>
                        {band.gain.toFixed(1)}dB
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs" style={{ color: 'var(--flux-ink-light)' }}>Q</span>
                      <input type="range" min="0.1" max="10" step="0.1" value={band.Q}
                        onChange={e => setBand(i, { Q: Number(e.target.value) })}
                        className="flex-1" style={{ accentColor: 'var(--flux-gold)' }} />
                      <span className="text-xs font-mono w-10 text-right" style={{ color: 'var(--flux-ink-light)' }}>
                        {band.Q.toFixed(1)}
                      </span>
                    </div>
                    {['lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass'].includes(band.type) && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs" style={{ color: 'var(--flux-ink-light)' }}>f</span>
                        <input type="range" min={band.freq * 0.5} max={Math.min(band.freq * 2, 20000)} step="10" value={band.freq}
                          onChange={e => setBand(i, { freq: Number(e.target.value) })}
                          className="flex-1" style={{ accentColor: 'var(--flux-gold)' }} />
                        <span className="text-xs font-mono w-10 text-right" style={{ color: 'var(--flux-ink-light)' }}>
                          {band.freq >= 1000 ? (band.freq / 1000).toFixed(1) + 'k' : band.freq}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4 mt-4 text-sm" style={{ color: 'var(--flux-ink-light)' }}>
                <label className="flex items-center gap-2">
                  <span>预增益</span>
                  <input type="range" min="-12" max="6" step="0.5" value={preamp}
                    onChange={e => setPreamp(Number(e.target.value))} className="w-24" style={{ accentColor: 'var(--flux-gold)' }} />
                  <span>{preamp} dB</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={limiterOn} onChange={e => setLimiterOn(e.target.checked)} className="accent-amber-600" />
                  <span>动态限幅</span>
                </label>
              </div>
            </div>

            {/* Differential Surround Panel */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4" style={{ color: 'var(--flux-gold)' }} />
                  <div>
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>Differential Surround</span>
                    <h2 className="text-lg font-bold mt-0.5" style={{ color: 'var(--flux-ink)' }}>差分环绕声处理</h2>
                  </div>
                </div>
                <button onClick={() => setSurroundEnabled(e => !e)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: surroundEnabled ? 'var(--flux-gold)' : 'var(--flux-line)', color: surroundEnabled ? 'var(--flux-marble)' : 'var(--flux-ink-light)' }}>
                  {surroundEnabled ? '已启用' : '已关闭'}
                </button>
              </div>

              <p className="text-xs mb-4" style={{ color: 'var(--flux-ink-light)' }}>
                将立体声分解为和信号 M=(L+R)/2 与差信号 S=(L-R)/2。对 S 做高通去低频轰鸣、低通去高频串扰，再加 Haas 延迟后反相混合到左右声道，产生虚拟环绕声场。
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'centerGain', label: 'Center 增益', min: 0, max: 2, step: 0.01, unit: '' },
                  { key: 'surroundWidth', label: 'Surround 宽度', min: 0, max: 2, step: 0.01, unit: '' },
                  { key: 'hpFreq', label: '高通截止', min: 20, max: 1000, step: 10, unit: 'Hz' },
                  { key: 'lpFreq', label: '低通截止', min: 1000, max: 16000, step: 100, unit: 'Hz' },
                  { key: 'eqGain', label: '环绕 EQ 增益', min: -12, max: 12, step: 0.5, unit: 'dB' },
                  { key: 'delayTime', label: '延迟时间', min: 0, max: 50, step: 0.5, unit: 'ms' },
                  { key: 'surroundGain', label: '环绕增益', min: 0, max: 2, step: 0.01, unit: '' },
                  { key: 'outputGain', label: '总输出增益', min: 0, max: 2, step: 0.01, unit: '' },
                ].map(p => (
                  <div key={p.key} className="rounded-xl border p-3" style={{ borderColor: 'var(--flux-line)', background: 'rgba(255,255,255,0.5)' }}>
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--flux-ink-light)' }}>
                      <span>{p.label}</span>
                      <span className="font-mono" style={{ color: 'var(--flux-gold)' }}>
                        {p.unit === 'Hz' ? Math.round(surroundParams[p.key as keyof typeof surroundParams]) + 'Hz'
                          : p.unit === 'dB' ? (surroundParams[p.key as keyof typeof surroundParams] as number).toFixed(1) + 'dB'
                          : p.unit === 'ms' ? (surroundParams[p.key as keyof typeof surroundParams] as number).toFixed(1) + 'ms'
                          : (surroundParams[p.key as keyof typeof surroundParams] as number).toFixed(2)}
                      </span>
                    </div>
                    <input type="range" min={p.min} max={p.max} step={p.step}
                      value={surroundParams[p.key as keyof typeof surroundParams]}
                      onChange={e => setSurroundParam(p.key, Number(e.target.value))}
                      className="w-full" style={{ accentColor: 'var(--flux-gold)' }} />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {[
                  { name: 'music', label: '🎵 音乐' },
                  { name: 'movie', label: '🎬 电影' },
                  { name: 'voice', label: '🗣️ 语音' },
                  { name: 'wide', label: '↔️ 超宽' },
                ].map(p => (
                  <button key={p.name} onClick={() => {
                    const P = {
                      music: { centerGain: 1, surroundWidth: 1, lpFreq: 8000, hpFreq: 150, eqGain: 0, delayTime: 15, surroundGain: 0.9, outputGain: 0.8 },
                      movie: { centerGain: 1.2, surroundWidth: 1.3, lpFreq: 7000, hpFreq: 200, eqGain: 2, delayTime: 25, surroundGain: 1.1, outputGain: 0.8 },
                      voice: { centerGain: 1.4, surroundWidth: 0.3, lpFreq: 5000, hpFreq: 300, eqGain: -2, delayTime: 5, surroundGain: 0.3, outputGain: 0.8 },
                      wide: { centerGain: 0.8, surroundWidth: 1.8, lpFreq: 12000, hpFreq: 80, eqGain: 3, delayTime: 12, surroundGain: 1.3, outputGain: 0.8 },
                    };
                    const preset = (P as any)[p.name];
                    if (preset) { setSurroundParams(preset); setSurroundEnabled(true); setStatusMsg('已加载环绕预设: ' + p.label); }
                  }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Track List */}
            <div className="rounded-2xl border p-5 md:p-6" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>Playlist</span>
                  <h2 className="text-lg font-bold mt-1" style={{ color: 'var(--flux-ink)' }}>获取音源</h2>
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePrev} disabled={tracks.length === 0}
                    className="p-2 rounded-lg border transition-all disabled:opacity-30"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}><SkipBack className="w-4 h-4" /></button>
                  <button onClick={handleTogglePlay} disabled={tracks.length === 0 && !globalAudio.src}
                    className="p-2 rounded-lg transition-all disabled:opacity-30"
                    style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <button onClick={handleNext} disabled={tracks.length === 0}
                    className="p-2 rounded-lg border transition-all disabled:opacity-30"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}><SkipForward className="w-4 h-4" /></button>
                </div>
              </div>

              {tracks.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--flux-ink-light)' }}>
                  {loadingList ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 正在读取音源...</span> : '暂无音源，请在右侧上传或配置 Worker API'}
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hidden">
                  {tracks.map((track, i) => (
                    <button key={i} onClick={() => {
                      if (!track.url) return;
                      globalAudio.src = track.url;
                      // Play the clicked track by updating state
                      setIsPlaying(true);
                      setStatusMsg('正在播放：' + track.title);
                      globalAudio.play().catch(() => setPlayerError('播放失败'));
                    }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${currentTrack === i ? 'border-amber-500/30' : 'border-transparent hover:border-[var(--flux-line)]'}`}
                      style={currentTrack === i ? { background: 'rgba(212,175,55,0.08)' } : {}}>
                      <span className="text-xs w-5 text-center font-bold" style={{ color: 'var(--flux-ink-light)' }}>{i + 1}</span>
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
                  <input type="url" value={workerApi}
                    onChange={e => { setWorkerApi(e.target.value); setStored('qcAudioApiBase', e.target.value); }}
                    placeholder="https://your-worker.example.com"
                    className="w-full min-h-[2.5rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                    style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--flux-ink-light)' }}>公共下载根地址</label>
                  <input type="url" value={publicBase}
                    onChange={e => { setPublicBase(e.target.value); setStored('qcAudioPublicBase', e.target.value); }}
                    className="w-full min-h-[2.5rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                    style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--flux-ink-light)' }}>开发者删除令牌</label>
                  <input type="password" value={devToken}
                    onChange={e => { setDevToken(e.target.value); setStored('qcAudioDevToken', e.target.value); }}
                    placeholder="只保存在当前浏览器"
                    className="w-full min-h-[2.5rem] rounded-lg px-3 text-sm border outline-none focus:ring-2 transition-all"
                    style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)', color: 'var(--flux-ink)' }} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--flux-ink-light)' }}>上传音源</label>
                  <input type="file" accept="audio/*,.flac"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                    className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium"
                    style={{ color: 'var(--flux-ink-light)' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
                    const file = input?.files?.[0]; if (file) uploadFile(file);
                  }} disabled={uploading}
                    className="flex-1 min-h-[2.5rem] rounded-lg text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}>
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    上传到 R2
                  </button>
                  <button onClick={refreshList} disabled={loadingList}
                    className="px-4 min-h-[2.5rem] rounded-lg text-sm font-medium border transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                    <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
                  </button>
                </div>
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
                  r2Objects.map(obj => {
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
                          <button onClick={() => loadUrl(url, name)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}>
                            <Music className="w-3 h-3" /> 播放
                          </button>
                          <a href={url} download
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
                            style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                            <Download className="w-3 h-3" /> 下载
                          </a>
                          <button onClick={() => deleteObject(obj.key)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
                            style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
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

/* ========== Visualization Helpers ========== */
function drawSpectrum(canvas: HTMLCanvasElement | null, analyser: AnalyserNode | null, c1: string, c2: string) {
  if (!canvas || !analyser) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const buf = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(buf);

  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bars = 90;
  const step = Math.floor(buf.length / bars);
  let x = 0;
  const barW = (canvas.width / bars) * 0.85;

  for (let i = 0; i < bars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += buf[i * step + j] || 0;
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

  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let db = -24; db <= 24; db += 6) {
    const y = h / 2 - (db / 24) * (h / 2);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px monospace';
    ctx.fillText(db + 'dB', 4, y - 2);
  }
  for (let i = 0; i <= 10; i++) {
    const freq = 20 * Math.pow(1000, i / 10);
    const x = (i / 10) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px monospace';
    const label = freq >= 1000 ? (freq / 1000).toFixed(0) + 'k' : freq.toFixed(0);
    ctx.fillText(label, x + 2, h - 4);
  }

  // Compute response
  const freqs = new Float32Array(512);
  const totalMag = new Float32Array(512).fill(1.0);
  const mag = new Float32Array(512);
  const phase = new Float32Array(512);

  for (let i = 0; i < 512; i++) {
    freqs[i] = 20 * Math.pow(1000, i / 511);
  }

  try {
    filters.forEach(filter => {
      if (!filter) return;
      filter.getFrequencyResponse(freqs, mag, phase);
      for (let i = 0; i < 512; i++) {
        totalMag[i] *= mag[i];
      }
    });

    // Draw curve
    ctx.beginPath();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i++) {
      const x = (i / 511) * w;
      const db = 20 * Math.log10(Math.max(totalMag[i], 0.0001));
      const y = h / 2 - (db / 24) * (h / 2);
      if (i === 0) ctx.moveTo(x, Math.max(0, Math.min(h, y)));
      else ctx.lineTo(x, Math.max(0, Math.min(h, y)));
    }
    ctx.stroke();

    // Fill
    ctx.lineTo(w, h / 2);
    ctx.lineTo(0, h / 2);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(212,175,55,0.15)');
    grad.addColorStop(0.5, 'rgba(212,175,55,0.02)');
    grad.addColorStop(1, 'rgba(212,175,55,0.15)');
    ctx.fillStyle = grad;
    ctx.fill();
  } catch {
    // getFrequencyResponse may fail if context not running
  }
}
