import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, FileAudio, Radio, RotateCcw, Volume2, Headphones } from 'lucide-react';

/* ========== AudioWorklet Processor Code ========== */
const WORKLET_CODE = `
class DifferentialSurroundProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.delayBuf = new Float32Array(48000);
    this.delayWrite = 0;
    this.lpX1 = 0; this.lpX2 = 0; this.lpY1 = 0; this.lpY2 = 0;
    this.hpX1 = 0; this.hpX2 = 0; this.hpY1 = 0; this.hpY2 = 0;
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
    const w0 = 2 * Math.PI * fc / fs;
    const cos = Math.cos(w0), sin = Math.sin(w0);
    const alpha = sin / (2 * Q);
    const a0 = 1 + alpha;
    const b0 = (1 - cos) / 2, b1 = 1 - cos, b2 = (1 - cos) / 2;
    const a1 = -2 * cos, a2 = 1 - alpha;
    return { b0:b0/a0, b1:b1/a0, b2:b2/a0, a1:a1/a0, a2:a2/a0 };
  }

  calcHPF(fc, fs, Q=0.707) {
    const w0 = 2 * Math.PI * fc / fs;
    const cos = Math.cos(w0), sin = Math.sin(w0);
    const alpha = sin / (2 * Q);
    const a0 = 1 + alpha;
    const b0 = (1 + cos) / 2, b1 = -(1 + cos), b2 = (1 + cos) / 2;
    const a1 = -2 * cos, a2 = 1 - alpha;
    return { b0:b0/a0, b1:b1/a0, b2:b2/a0, a1:a1/a0, a2:a2/a0 };
  }

  process(inputs, outputs, parameters) {
    const inp = inputs[0];
    const out = outputs[0];
    if (!inp || !inp[0] || !inp[1]) return true;

    const L = inp[0], R = inp[1];
    const OL = out[0], OR = out[1];

    const cGain = parameters.centerGain[0];
    const sWidth = parameters.surroundWidth[0];
    const lpF = parameters.lpFreq[0];
    const hpF = parameters.hpFreq[0];
    const eqG = Math.pow(10, parameters.eqGain[0] / 20);
    const dlyMs = parameters.delayTime[0];
    const sGain = parameters.surroundGain[0];
    const outG = parameters.outputGain[0];
    const bypass = parameters.bypass[0] > 0.5;

    const dlySamples = Math.max(0, Math.floor(dlyMs * sampleRate / 1000));
    const lpC = this.calcLPF(lpF, sampleRate);
    const hpC = this.calcHPF(hpF, sampleRate);

    for (let i = 0; i < L.length; i++) {
      const l = L[i], r = R[i];
      if (bypass) { OL[i] = l * outG; OR[i] = r * outG; continue; }

      const C = (l + r) * 0.5 * cGain;
      const S = (l - r) * 0.5 * sWidth;

      // HPF
      const hy = hpC.b0*S + hpC.b1*this.hpX1 + hpC.b2*this.hpX2 - hpC.a1*this.hpY1 - hpC.a2*this.hpY2;
      this.hpX2 = this.hpX1; this.hpX1 = S; this.hpY2 = this.hpY1; this.hpY1 = hy;

      // LPF
      const ly_ = lpC.b0*hy + lpC.b1*this.lpX1 + lpC.b2*this.lpX2 - lpC.a1*this.lpY1 - lpC.a2*this.lpY2;
      this.lpX2 = this.lpX1; this.lpX1 = hy; this.lpY2 = this.lpY1; this.lpY1 = ly_;

      const filteredS = ly_ * eqG;

      // Delay line
      const readIdx = (this.delayWrite - dlySamples + this.delayBuf.length) % this.delayBuf.length;
      const delayedS = dlySamples > 0 ? this.delayBuf[readIdx] : filteredS;
      this.delayBuf[this.delayWrite] = filteredS;
      this.delayWrite = (this.delayWrite + 1) % this.delayBuf.length;

      const wet = delayedS * sGain;
      OL[i] = (C + wet) * outG;
      OR[i] = (C - wet) * outG;
    }
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
  format?: (v: number) => string;
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
  music:  { centerGain: 1, surroundWidth: 1, lpFreq: 8000, hpFreq: 150, eqGain: 0, delayTime: 15, surroundGain: 0.9, outputGain: 0.8 },
  movie:  { centerGain: 1.2, surroundWidth: 1.3, lpFreq: 7000, hpFreq: 200, eqGain: 2, delayTime: 25, surroundGain: 1.1, outputGain: 0.8 },
  voice:  { centerGain: 1.4, surroundWidth: 0.3, lpFreq: 5000, hpFreq: 300, eqGain: -2, delayTime: 5, surroundGain: 0.3, outputGain: 0.8 },
  wide:   { centerGain: 0.8, surroundWidth: 1.8, lpFreq: 12000, hpFreq: 80, eqGain: 3, delayTime: 12, surroundGain: 1.3, outputGain: 0.8 },
  bypass: { centerGain: 1, surroundWidth: 1, lpFreq: 7000, hpFreq: 200, eqGain: 0, delayTime: 0, surroundGain: 0, outputGain: 1 },
};

export default function DifferentialSurround() {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    PARAMS.forEach(p => init[p.id] = p.default);
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

    const aIn = ctx.createAnalyser(); aIn.fftSize = 2048;
    const aOut = ctx.createAnalyser(); aOut.fftSize = 2048;
    analyserInRef.current = aIn;
    analyserOutRef.current = aOut;

    proc.connect(gain);
    gain.connect(aOut);
    gain.connect(ctx.destination);

    // Set initial params
    PARAMS.forEach(p => {
      proc.parameters.get(p.id)?.setValueAtTime(p.default, ctx.currentTime);
    });
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stopAllSources();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const stopAllSources = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    demoOscRef.current.forEach(o => { try { o.stop(); o.disconnect(); } catch {} });
    demoOscRef.current = [];
    if (fileAudioRef.current) {
      fileAudioRef.current.pause();
      fileAudioRef.current.src = '';
      fileAudioRef.current = null;
    }
    setInputMode('none');
  }, []);

  const loadFile = useCallback(async (file: File) => {
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
    audio.play().catch(() => {});
    setStatus('播放: ' + file.name);
    setInputMode('file');
  }, [initAudio, stopAllSources]);

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
    const gL = ctx.createGain(), gR = ctx.createGain();
    const merger = ctx.createChannelMerger(2);

    oscL.type = 'sine'; oscL.frequency.value = 440;
    oscR.type = 'sine'; oscR.frequency.value = 660;
    gL.gain.value = 0.25; gR.gain.value = 0.25;

    oscL.connect(gL); oscR.connect(gR);
    gL.connect(merger, 0, 0); gR.connect(merger, 0, 1);

    const source = merger;
    sourceNodeRef.current = source;
    source.connect(analyserInRef.current!);
    source.connect(procNodeRef.current!);

    oscL.start(); oscR.start();
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
    setValues(prev => ({ ...prev, [id]: val }));
    if (procNodeRef.current && audioCtxRef.current) {
      procNodeRef.current.parameters.get(id)?.setValueAtTime(val, audioCtxRef.current.currentTime);
    }
  }, []);

  const loadPreset = useCallback((name: string) => {
    const p = PRESETS[name];
    if (!p) return;
    Object.entries(p).forEach(([k, v]) => updateParam(k, v));
    setStatus('已加载预设: ' + name);
  }, [updateParam]);

  // Visualization loop
  useEffect(() => {
    const draw = () => {
      drawSpectrum(canvasInRef.current, analyserInRef.current, '#d4af37', '#b8960c');
      drawSpectrum(canvasOutRef.current, analyserOutRef.current, '#00d2ff', '#3a7bd5');
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
    <div className="pt-20 pb-12 min-h-screen" style={{ background: 'var(--flux-marble)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="mb-10">
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--flux-gold)' }}>
            Differential Surround DSP
          </span>
          <h1 className="text-4xl md:text-5xl font-black mt-2 mb-4" style={{ color: 'var(--flux-ink)' }}>
            差分环绕 EQ 控制台
          </h1>
          <p className="max-w-2xl text-sm md:text-base leading-relaxed" style={{ color: 'var(--flux-ink-light)' }}>
            基于 Web Audio API + AudioWorklet 的纯软件差分环绕处理器。将立体声分解为和信号（中置）与差信号（环绕），对差信号做 EQ、Haas 延迟后反相混合，产生虚拟环绕声场。
          </p>
        </section>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 items-center mb-6 p-4 rounded-xl border" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble-dark)' }}>
          <input type="file" id="ds-file" accept="audio/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
          <label htmlFor="ds-file" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: 'var(--flux-gold)', color: 'var(--flux-marble)' }}>
            <FileAudio className="w-4 h-4" /> 加载音频
          </label>
          <button onClick={loadMic} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
            <Mic className="w-4 h-4" /> 麦克风
          </button>
          <button onClick={loadDemo} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
            <Radio className="w-4 h-4" /> 演示信号
          </button>
          <button onClick={toggleBypass}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isBypass ? 'opacity-100' : 'opacity-70'}`}
            style={{ background: isBypass ? '#7f1d1d' : 'var(--flux-line)', color: isBypass ? '#fecaca' : 'var(--flux-ink-light)' }}>
            <RotateCcw className="w-4 h-4" /> Bypass: {isBypass ? '开' : '关'}
          </button>
          <span className="ml-auto text-xs font-mono" style={{ color: 'var(--flux-ink-light)' }}>{status}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visualizer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--flux-gold)' }}>输入频谱</span>
              </div>
              <canvas ref={canvasInRef} width={800} height={180} className="w-full rounded-lg"
                style={{ background: 'var(--flux-marble-dark)' }} />
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--flux-gold)' }}>输出频谱（处理后）</span>
              </div>
              <canvas ref={canvasOutRef} width={800} height={180} className="w-full rounded-lg"
                style={{ background: 'var(--flux-marble-dark)' }} />
            </div>

            {/* Signal Flow Diagram */}
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--flux-ink)' }}>信号流</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--flux-ink-light)' }}>
                <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--flux-line)' }}>L / R 输入</span>
                <span>→</span>
                <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--flux-line)' }}>矩阵解码</span>
                <span>→</span>
                <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--flux-gold)', color: 'var(--flux-gold)' }}>M=(L+R)/2</span>
                <span>+</span>
                <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--flux-gold)', color: 'var(--flux-gold)' }}>S=(L-R)/2</span>
                <span>→</span>
                <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--flux-line)' }}>HPF → LPF → EQ</span>
                <span>→</span>
                <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--flux-line)' }}>Haas 延迟</span>
                <span>→</span>
                <span className="px-2 py-1 rounded border" style={{ borderColor: 'var(--flux-line)' }}>Out = M ± S_delayed</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Matrix */}
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--flux-gold)' }}>矩阵解码</h3>
              {PARAMS.slice(0, 2).map(p => (
                <div key={p.id} className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--flux-ink-light)' }}>
                    <span>{p.label}</span>
                    <span className="font-mono" style={{ color: 'var(--flux-gold)' }}>{formatVal(p, values[p.id])}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={values[p.id]}
                    onChange={(e) => updateParam(p.id, Number(e.target.value))}
                    className="w-full" style={{ accentColor: 'var(--flux-gold)' }} />
                </div>
              ))}
            </div>

            {/* EQ */}
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--flux-gold)' }}>差分 EQ（仅处理 S=L-R）</h3>
              {PARAMS.slice(2, 5).map(p => (
                <div key={p.id} className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--flux-ink-light)' }}>
                    <span>{p.label}</span>
                    <span className="font-mono" style={{ color: 'var(--flux-gold)' }}>{formatVal(p, values[p.id])}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={values[p.id]}
                    onChange={(e) => updateParam(p.id, Number(e.target.value))}
                    className="w-full" style={{ accentColor: 'var(--flux-gold)' }} />
                </div>
              ))}
            </div>

            {/* Surround */}
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--flux-gold)' }}>环绕处理（Haas 效应）</h3>
              {PARAMS.slice(5, 7).map(p => (
                <div key={p.id} className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--flux-ink-light)' }}>
                    <span>{p.label}</span>
                    <span className="font-mono" style={{ color: 'var(--flux-gold)' }}>{formatVal(p, values[p.id])}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={values[p.id]}
                    onChange={(e) => updateParam(p.id, Number(e.target.value))}
                    className="w-full" style={{ accentColor: 'var(--flux-gold)' }} />
                </div>
              ))}
            </div>

            {/* Output */}
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--flux-gold)' }}>输出</h3>
              {PARAMS.slice(7).map(p => (
                <div key={p.id} className="mb-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--flux-ink-light)' }}>
                    <span>{p.label}</span>
                    <span className="font-mono" style={{ color: 'var(--flux-gold)' }}>{formatVal(p, values[p.id])}</span>
                  </div>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={values[p.id]}
                    onChange={(e) => updateParam(p.id, Number(e.target.value))}
                    className="w-full" style={{ accentColor: 'var(--flux-gold)' }} />
                </div>
              ))}
            </div>

            {/* Presets */}
            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--flux-line)', background: 'var(--flux-marble)' }}>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--flux-gold)' }}>预设</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PRESETS).map(([name]) => (
                  <button key={name} onClick={() => loadPreset(name)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                    style={{ borderColor: 'var(--flux-line)', color: 'var(--flux-ink-light)' }}>
                    {name === 'music' ? '🎵 音乐' : name === 'movie' ? '🎬 电影' : name === 'voice' ? '🗣️ 语音' : name === 'wide' ? '↔️ 超宽' : '⏹️ 重置'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
