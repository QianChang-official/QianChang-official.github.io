import { FileAudio, Mic, Radio, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { drawSpectrum } from './draw';

/* ========== AudioWorklet Processor Code ========== */
const WORKLET_CODE = `
class DifferentialSurroundProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.maxDelay = Math.floor(sampleRate * 0.06) + 2; // 60ms headroom over the 50ms param cap
    this.delayBuf = new Float32Array(this.maxDelay);
    this.delayWrite = 0;
    this.lpX1=0;this.lpX2=0;this.lpY1=0;this.lpY2=0;
    this.hpX1=0;this.hpX2=0;this.hpY1=0;this.hpY2=0;
    this.lastLp=-1;this.lastHp=-1;
    this.lpC=null;this.hpC=null;
    this.curDelay=0;  // smoothed fractional delay, in samples
    this.bypassMix=0; // 1 = fully bypassed; crossfades to avoid clicks
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
      {name:'bypass',       defaultValue:0,    minValue:0,   maxValue:1, automationRate:'k-rate'}
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
    const outG=parameters.outputGain[0];
    const bypassTarget=parameters.bypass[0]>0.5?1:0;

    // Recompute filter coefficients only when a cutoff actually changed —
    // allocating them every render quantum GC-churns the audio thread (crackle).
    if(lpF!==this.lastLp){ this.lpC=this.calcLPF(lpF,sampleRate); this.lastLp=lpF; }
    if(hpF!==this.lastHp){ this.hpC=this.calcHPF(hpF,sampleRate); this.lastHp=hpF; }
    const lpC=this.lpC, hpC=this.hpC;

    const targetDelay=Math.min(this.maxDelay-2, Math.max(0, dlyMs*sampleRate/1000));
    const buf=this.delayBuf, len=buf.length;
    let w=this.delayWrite;
    let lpX1=this.lpX1,lpX2=this.lpX2,lpY1=this.lpY1,lpY2=this.lpY2;
    let hpX1=this.hpX1,hpX2=this.hpX2,hpY1=this.hpY1,hpY2=this.hpY2;
    let curDelay=this.curDelay, bypassMix=this.bypassMix;

    for(let i=0;i<L.length;i++){
      const l=L[i], r=R[i];
      // ~4ms one-pole smoothing: delay glide and bypass toggle stay click-free
      curDelay+=(targetDelay-curDelay)*0.01;
      bypassMix+=(bypassTarget-bypassMix)*0.01;

      const C=(l+r)*0.5*cGain, S=(l-r)*0.5*sWidth;

      const hy=hpC.b0*S+hpC.b1*hpX1+hpC.b2*hpX2-hpC.a1*hpY1-hpC.a2*hpY2;
      hpX2=hpX1;hpX1=S;hpY2=hpY1;hpY1=hy;

      const ly_=lpC.b0*hy+lpC.b1*lpX1+lpC.b2*lpX2-lpC.a1*lpY1-lpC.a2*lpY2;
      lpX2=lpX1;lpX1=hy;lpY2=lpY1;lpY1=ly_;

      const filteredS=ly_*eqG;

      // Write first, then read curDelay samples back with linear interpolation
      buf[w]=filteredS;
      const rp=w-curDelay;
      const i0=Math.floor(rp), frac=rp-i0;
      const older=buf[((i0%len)+len)%len];
      const newer=buf[(((i0+1)%len)+len)%len];
      const delayedS=older*(1-frac)+newer*frac;
      w=(w+1)%len;

      const wet=delayedS*sGain;
      const bm=bypassMix;
      OL[i]=(l*bm+(C+wet)*(1-bm))*outG;
      OR[i]=(r*bm+(C-wet)*(1-bm))*outG;
    }

    this.delayWrite=w;
    this.lpX1=lpX1;this.lpX2=lpX2;this.lpY1=lpY1;this.lpY2=lpY2;
    this.hpX1=hpX1;this.hpX2=hpX2;this.hpY1=hpY1;this.hpY2=hpY2;
    this.curDelay=curDelay;this.bypassMix=bypassMix;
    return true;
  }
}
registerProcessor('differential-surround', DifferentialSurroundProcessor);
`;

interface ParamConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
}

const PARAMS: ParamConfig[] = [
  { id: 'centerGain', label: 'Center 增益', min: 0, max: 2, step: 0.01, default: 1, unit: '' },
  { id: 'surroundWidth', label: 'Surround 宽度', min: 0, max: 2, step: 0.01, default: 1, unit: '' },
  { id: 'hpFreq', label: '高通截止', min: 20, max: 1000, step: 10, default: 200, unit: 'Hz' },
  { id: 'lpFreq', label: '低通截止', min: 1000, max: 16000, step: 100, default: 7000, unit: 'Hz' },
  { id: 'eqGain', label: 'EQ 增益', min: -12, max: 12, step: 0.5, default: 0, unit: 'dB' },
  { id: 'delayTime', label: '延迟时间', min: 0, max: 50, step: 0.5, default: 20, unit: 'ms' },
  { id: 'surroundGain', label: '环绕增益', min: 0, max: 2, step: 0.01, default: 1, unit: '' },
  { id: 'outputGain', label: '总输出增益', min: 0, max: 2, step: 0.01, default: 0.8, unit: '' },
];

const PRESETS: Record<string, Record<string, number>> = {
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
  bypass: {
    centerGain: 1,
    surroundWidth: 1,
    lpFreq: 7000,
    hpFreq: 200,
    eqGain: 0,
    delayTime: 0,
    surroundGain: 0,
    outputGain: 1,
  },
};

export default function DifferentialSurround() {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of PARAMS) {
      init[p.id] = p.default;
    }
    return init;
  });
  const [isBypass, setIsBypass] = useState(false);
  const [status, setStatus] = useState('等待音频源…');
  const [inputMode, setInputMode] = useState<'none' | 'file' | 'mic' | 'demo'>('none');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const procNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);
  const analyserInRef = useRef<AnalyserNode | null>(null);
  const analyserOutRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const demoOscRef = useRef<OscillatorNode[]>([]);
  const objectUrlRef = useRef<string | null>(null);
  const fileAudioRef = useRef<HTMLAudioElement | null>(null);

  const canvasInRef = useRef<HTMLCanvasElement | null>(null);
  const canvasOutRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // Initialize audio context + worklet once
  const initAudio = useCallback(async () => {
    if (audioCtxRef.current) return;
    const ctx = new AudioContext({ sampleRate: 48000 });
    audioCtxRef.current = ctx;

    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);

    const proc = new AudioWorkletNode(ctx, 'differential-surround', { outputChannelCount: [2] });
    procNodeRef.current = proc;

    const gain = ctx.createGain();
    gain.gain.value = 1;
    gainNodeRef.current = gain;

    const aIn = ctx.createAnalyser();
    aIn.fftSize = 2048;
    const aOut = ctx.createAnalyser();
    aOut.fftSize = 2048;
    analyserInRef.current = aIn;
    analyserOutRef.current = aOut;

    proc.connect(gain);
    gain.connect(aOut);
    gain.connect(ctx.destination);

    // Set initial params
    PARAMS.forEach((p) => {
      proc.parameters.get(p.id)?.setValueAtTime(p.default, ctx.currentTime);
    });
  }, []);

  // Cleanup
  // biome-ignore lint/correctness/useExhaustiveDependencies: teardown runs once on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stopAllSources();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAllSources = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        /* ignore */
      }
      sourceNodeRef.current = null;
    }
    demoOscRef.current.forEach((o) => {
      try {
        o.stop();
        o.disconnect();
      } catch {
        /* ignore */
      }
    });
    demoOscRef.current = [];
    if (fileAudioRef.current) {
      fileAudioRef.current.pause();
      fileAudioRef.current.src = '';
      fileAudioRef.current = null;
    }
    setInputMode('none');
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      await initAudio();
      stopAllSources();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audio.loop = true;
      audio.crossOrigin = 'anonymous';
      fileAudioRef.current = audio;

      const source = audioCtxRef.current!.createMediaElementSource(audio);
      sourceNodeRef.current = source;
      source.connect(analyserInRef.current!);
      source.connect(procNodeRef.current!);
      audio.play().catch(() => {
        /* ignore */
      });
      setStatus('播放: ' + file.name);
      setInputMode('file');
    },
    [initAudio, stopAllSources],
  );

  const loadMic = useCallback(async () => {
    await initAudio();
    stopAllSources();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioCtxRef.current!.createMediaStreamSource(stream);
    sourceNodeRef.current = source;
    source.connect(analyserInRef.current!);
    source.connect(procNodeRef.current!);
    setStatus('麦克风输入中（请戴耳机）');
    setInputMode('mic');
  }, [initAudio, stopAllSources]);

  const loadDemo = useCallback(async () => {
    await initAudio();
    stopAllSources();
    const ctx = audioCtxRef.current!;
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    const gL = ctx.createGain(),
      gR = ctx.createGain();
    const merger = ctx.createChannelMerger(2);

    oscL.type = 'sine';
    oscL.frequency.value = 440;
    oscR.type = 'sine';
    oscR.frequency.value = 660;
    gL.gain.value = 0.25;
    gR.gain.value = 0.25;

    oscL.connect(gL);
    oscR.connect(gR);
    gL.connect(merger, 0, 0);
    gR.connect(merger, 0, 1);

    const source = merger;
    sourceNodeRef.current = source;
    source.connect(analyserInRef.current!);
    source.connect(procNodeRef.current!);

    oscL.start();
    oscR.start();
    demoOscRef.current = [oscL, oscR];
    setStatus('演示: 440Hz + 660Hz 立体声测试音');
    setInputMode('demo');
  }, [initAudio, stopAllSources]);

  const toggleBypass = useCallback(() => {
    const next = !isBypass;
    setIsBypass(next);
    if (procNodeRef.current && audioCtxRef.current) {
      procNodeRef.current.parameters.get('bypass')?.setValueAtTime(next ? 1 : 0, audioCtxRef.current.currentTime);
    }
  }, [isBypass]);

  const updateParam = useCallback((id: string, val: number) => {
    setValues((prev) => ({ ...prev, [id]: val }));
    if (procNodeRef.current && audioCtxRef.current) {
      procNodeRef.current.parameters.get(id)?.setValueAtTime(val, audioCtxRef.current.currentTime);
    }
  }, []);

  const loadPreset = useCallback(
    (name: string) => {
      const p = PRESETS[name];
      if (!p) return;
      Object.entries(p).forEach(([k, v]) => {
        updateParam(k, v);
      });
      setStatus('已加载预设: ' + name);
    },
    [updateParam],
  );

  // Visualization loop
  useEffect(() => {
    const readSpectrum = (a: AnalyserNode | null) => {
      if (!a) return null;
      const buf = new Uint8Array(a.frequencyBinCount);
      a.getByteFrequencyData(buf);
      return buf;
    };
    const draw = () => {
      drawSpectrum(canvasInRef.current, readSpectrum(analyserInRef.current), ['#ed6ea0', '#e91e63']);
      drawSpectrum(canvasOutRef.current, readSpectrum(analyserOutRef.current), ['#57b5f2', '#2b7fd4']);
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const formatVal = (p: ParamConfig, v: number) => {
    if (p.unit === 'Hz') return Math.round(v) + 'Hz';
    if (p.unit === 'kHz') return (v / 1000).toFixed(1) + 'kHz';
    if (p.unit === 'dB') return v.toFixed(1) + 'dB';
    if (p.unit === 'ms') return v.toFixed(1) + 'ms';
    return v.toFixed(2);
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm leading-relaxed">
        基于 Web Audio API + AudioWorklet 的纯软件差分环绕处理器。将立体声分解为和信号（中置）与差信号（环绕），对差信号做
        EQ、Haas 延迟后反相混合，产生虚拟环绕声场。
      </p>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
        <input
          type="file"
          id="ds-file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
          }}
        />
        <label
          htmlFor="ds-file"
          className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all ${inputMode === 'file' ? 'bg-primary/15 text-primary' : 'bg-primary text-primary-foreground hover:opacity-90'}`}
        >
          <FileAudio className="h-4 w-4" /> 加载音频
        </label>
        <button
          type="button"
          onClick={loadMic}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-sm transition-all ${inputMode === 'mic' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
        >
          <Mic className="h-4 w-4" /> 麦克风
        </button>
        <button
          type="button"
          onClick={loadDemo}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-sm transition-all ${inputMode === 'demo' ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
        >
          <Radio className="h-4 w-4" /> 演示信号
        </button>
        <button
          type="button"
          onClick={toggleBypass}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all ${isBypass ? 'bg-red-600/90 text-white' : 'border border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground'}`}
        >
          <RotateCcw className="h-4 w-4" /> Bypass: {isBypass ? '开' : '关'}
        </button>
        <span className="ml-auto font-mono text-muted-foreground text-xs">{status}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Visualizer */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold text-primary text-xs uppercase tracking-wider">输入频谱</span>
            </div>
            <canvas ref={canvasInRef} width={800} height={180} className="audio-canvas w-full rounded-lg" />
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold text-primary text-xs uppercase tracking-wider">输出频谱（处理后）</span>
            </div>
            <canvas ref={canvasOutRef} width={800} height={180} className="audio-canvas w-full rounded-lg" />
          </div>

          {/* Signal Flow Diagram */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-sm">信号流</h3>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
              <span className="rounded border border-border px-2 py-1">L / R 输入</span>
              <span>→</span>
              <span className="rounded border border-border px-2 py-1">矩阵解码</span>
              <span>→</span>
              <span className="rounded border border-primary/50 px-2 py-1 text-primary">M=(L+R)/2</span>
              <span>+</span>
              <span className="rounded border border-primary/50 px-2 py-1 text-primary">S=(L-R)/2</span>
              <span>→</span>
              <span className="rounded border border-border px-2 py-1">HPF → LPF → EQ</span>
              <span>→</span>
              <span className="rounded border border-border px-2 py-1">Haas 延迟</span>
              <span>→</span>
              <span className="rounded border border-border px-2 py-1">Out = M ± S_delayed</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Matrix */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-primary text-xs uppercase tracking-wider">矩阵解码</h3>
            {PARAMS.slice(0, 2).map((p) => (
              <div key={p.id} className="mb-3">
                <div className="mb-1 flex justify-between text-muted-foreground text-xs">
                  <span>{p.label}</span>
                  <span className="font-mono text-primary">{formatVal(p, values[p.id])}</span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={values[p.id]}
                  onChange={(e) => updateParam(p.id, Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
              </div>
            ))}
          </div>

          {/* EQ */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-primary text-xs uppercase tracking-wider">差分 EQ（仅处理 S=L-R）</h3>
            {PARAMS.slice(2, 5).map((p) => (
              <div key={p.id} className="mb-3">
                <div className="mb-1 flex justify-between text-muted-foreground text-xs">
                  <span>{p.label}</span>
                  <span className="font-mono text-primary">{formatVal(p, values[p.id])}</span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={values[p.id]}
                  onChange={(e) => updateParam(p.id, Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
              </div>
            ))}
          </div>

          {/* Surround */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-primary text-xs uppercase tracking-wider">环绕处理（Haas 效应）</h3>
            {PARAMS.slice(5, 7).map((p) => (
              <div key={p.id} className="mb-3">
                <div className="mb-1 flex justify-between text-muted-foreground text-xs">
                  <span>{p.label}</span>
                  <span className="font-mono text-primary">{formatVal(p, values[p.id])}</span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={values[p.id]}
                  onChange={(e) => updateParam(p.id, Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
              </div>
            ))}
          </div>

          {/* Output */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-primary text-xs uppercase tracking-wider">输出</h3>
            {PARAMS.slice(7).map((p) => (
              <div key={p.id} className="mb-3">
                <div className="mb-1 flex justify-between text-muted-foreground text-xs">
                  <span>{p.label}</span>
                  <span className="font-mono text-primary">{formatVal(p, values[p.id])}</span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={values[p.id]}
                  onChange={(e) => updateParam(p.id, Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
              </div>
            ))}
          </div>

          {/* Presets */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="mb-3 font-bold text-primary text-xs uppercase tracking-wider">预设</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([name]) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => loadPreset(name)}
                  className="rounded-lg border border-border px-3 py-1.5 font-medium text-muted-foreground text-xs transition-all hover:bg-muted/60 hover:text-foreground"
                >
                  {name === 'music'
                    ? '🎵 音乐'
                    : name === 'movie'
                      ? '🎬 电影'
                      : name === 'voice'
                        ? '🗣️ 语音'
                        : name === 'wide'
                          ? '↔️ 超宽'
                          : '⏹️ 重置'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
