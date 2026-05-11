/* ========== Global Audio Engine ========== */
/* Module-level singleton. Initializes once, survives page navigation. */

import { globalAudio } from '@/stores/audioStore';

/* ---- EQ Types ---- */
export interface EqBandConfig {
  id: number;
  label: string;
  freq: number;
  gain: number;
  Q: number;
  type: BiquadFilterType;
}

export const FILTER_TYPES: BiquadFilterType[] = [
  'peaking', 'lowshelf', 'highshelf', 'lowpass', 'highpass', 'notch', 'bandpass',
];

export const DEFAULT_EQ: EqBandConfig[] = [
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

export const EQ_PRESETS: Record<string, Partial<EqBandConfig>[]> = {
  Flat: DEFAULT_EQ.map((b) => ({ ...b, gain: 0 })),
  'FLAC Warm': [
    { gain: 2, type: 'lowshelf' }, { gain: 1.5 }, { gain: 1 }, { gain: 0.5 },
    { gain: 0 }, { gain: 0 }, { gain: 0.5 }, { gain: 1 }, { gain: 1.5 }, { gain: 2, type: 'highshelf' },
  ],
  Vocal: [
    { gain: -2 }, { gain: -1.5 }, { gain: -1 }, { gain: 0.5 }, { gain: 2 },
    { gain: 2.5 }, { gain: 1.5 }, { gain: 0.5 }, { gain: -0.5 }, { gain: -1 },
  ],
  Bass: [
    { gain: 5, type: 'lowshelf', Q: 1.4 }, { gain: 4 }, { gain: 2.5 }, { gain: 1 },
    { gain: 0 }, { gain: -0.5 }, { gain: -0.5 }, { gain: 0 }, { gain: 0 }, { gain: 0 },
  ],
  Bright: [
    { gain: -1 }, { gain: -1 }, { gain: -0.5 }, { gain: 0 }, { gain: 0.5 },
    { gain: 1.5 }, { gain: 2.5 }, { gain: 3.5 }, { gain: 4 }, { gain: 3, type: 'highshelf' },
  ],
  'Surround+Vocal': [
    { gain: 1, type: 'lowshelf' }, { gain: 0.5 }, { gain: 0 }, { gain: 1 }, { gain: 2.5 },
    { gain: 2 }, { gain: 1 }, { gain: 0.5 }, { gain: 1 }, { gain: 1.5, type: 'highshelf' },
  ],
};

/* ---- Surround Types ---- */
export interface SurroundParams {
  centerGain: number;
  surroundWidth: number;
  lpFreq: number;
  hpFreq: number;
  eqGain: number;
  delayTime: number;
  surroundGain: number;
  outputGain: number;
}

export const DEFAULT_SURROUND: SurroundParams = {
  centerGain: 1,
  surroundWidth: 1,
  lpFreq: 7000,
  hpFreq: 200,
  eqGain: 0,
  delayTime: 20,
  surroundGain: 1,
  outputGain: 0.8,
};

/* ---- Surround Worklet ---- */
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

/* ========== Engine State ========== */
let ctx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let surroundNode: AudioWorkletNode | null = null;
let filters: BiquadFilterNode[] = [];
let preampNode: GainNode | null = null;
let compressorNode: DynamicsCompressorNode | null = null;
let analyserIn: AnalyserNode | null = null;
let analyserOut: AnalyserNode | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;
let currentEqBands: EqBandConfig[] = JSON.parse(JSON.stringify(DEFAULT_EQ));
let currentPreamp = -1;
let currentLimiter = true;
let currentSurroundParams: SurroundParams = { ...DEFAULT_SURROUND };
let currentSurroundEnabled = false;

/* ========== Init ========== */
export async function initAudioEngine(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) throw new Error('Web Audio API not supported');

    ctx = new AC();

    // Register surround worklet
    try {
      const blob = new Blob([SURROUND_WORKLET], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
    } catch {
      // Worklet failed — surround will be unavailable
    }

    // Create nodes
    surroundNode = new AudioWorkletNode(ctx, 'differential-surround', { outputChannelCount: [2] });
    surroundNode.parameters.get('bypass')?.setValueAtTime(1, ctx.currentTime);

    analyserIn = ctx.createAnalyser();
    analyserIn.fftSize = 2048;
    analyserOut = ctx.createAnalyser();
    analyserOut.fftSize = 2048;

    preampNode = ctx.createGain();
    preampNode.gain.value = Math.pow(10, currentPreamp / 20);

    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.value = currentLimiter ? -4 : 0;
    compressorNode.knee.value = 10;
    compressorNode.ratio.value = currentLimiter ? 6 : 1;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.18;

    // Build EQ chain
    filters = currentEqBands.map((b) => {
      const f = ctx!.createBiquadFilter();
      f.type = b.type;
      f.frequency.value = b.freq;
      f.gain.value = b.gain;
      f.Q.value = b.Q;
      return f;
    });

    // Connect: source will be connected when available
    // For now, wire everything after source
    // source → analyserIn → surround → EQ → preamp → compressor → analyserOut → destination

    analyserIn.connect(surroundNode);

    let prev: AudioNode = surroundNode;
    filters.forEach((filter) => {
      prev.connect(filter);
      prev = filter;
    });
    prev.connect(preampNode);
    preampNode.connect(compressorNode);
    compressorNode.connect(analyserOut);
    analyserOut.connect(ctx.destination);

    // Apply current surround params
    applySurroundParams();

    initialized = true;
  })();

  return initPromise;
}

/* ========== Source Connection ========== */
/* Call this once when you want to start processing audio */
export function connectAudioSource(): void {
  if (!ctx || !analyserIn) return;
  if (sourceNode) return; // Already connected

  sourceNode = ctx.createMediaElementSource(globalAudio);
  sourceNode.connect(analyserIn);
  // Also connect bypass so audio plays even if engine not fully wired
  sourceNode.connect(ctx.destination);
}

/* ========== EQ Control ========== */
export function setEqBand(index: number, patch: Partial<EqBandConfig>): void {
  if (!filters[index]) return;
  const f = filters[index];
  const b = currentEqBands[index];
  if (patch.type !== undefined) {
    b.type = patch.type;
    f.type = patch.type;
  }
  if (patch.freq !== undefined) {
    b.freq = patch.freq;
    f.frequency.value = patch.freq;
  }
  if (patch.gain !== undefined) {
    b.gain = patch.gain;
    f.gain.value = patch.gain;
  }
  if (patch.Q !== undefined) {
    b.Q = patch.Q;
    f.Q.value = patch.Q;
  }
}

export function getEqBands(): EqBandConfig[] {
  return JSON.parse(JSON.stringify(currentEqBands));
}

export function applyEqPreset(name: string): void {
  const preset = EQ_PRESETS[name];
  if (!preset) return;
  currentEqBands.forEach((b, i) => {
    const p = preset[i];
    if (!p) return;
    setEqBand(i, p);
  });
}

export function resetEq(): void {
  currentEqBands = JSON.parse(JSON.stringify(DEFAULT_EQ));
  filters.forEach((f, i) => {
    const b = currentEqBands[i];
    f.type = b.type;
    f.frequency.value = b.freq;
    f.gain.value = b.gain;
    f.Q.value = b.Q;
  });
}

/* ========== Preamp / Limiter ========== */
export function setPreamp(value: number): void {
  currentPreamp = value;
  if (preampNode) preampNode.gain.value = Math.pow(10, value / 20);
}

export function setLimiter(enabled: boolean): void {
  currentLimiter = enabled;
  if (compressorNode) {
    compressorNode.threshold.value = enabled ? -4 : 0;
    compressorNode.ratio.value = enabled ? 6 : 1;
  }
}

/* ========== Surround Control ========== */
function applySurroundParams(): void {
  if (!surroundNode || !ctx) return;
  const s = currentSurroundParams;
  const t = ctx.currentTime;
  surroundNode.parameters.get('centerGain')?.setValueAtTime(s.centerGain, t);
  surroundNode.parameters.get('surroundWidth')?.setValueAtTime(s.surroundWidth, t);
  surroundNode.parameters.get('lpFreq')?.setValueAtTime(s.lpFreq, t);
  surroundNode.parameters.get('hpFreq')?.setValueAtTime(s.hpFreq, t);
  surroundNode.parameters.get('eqGain')?.setValueAtTime(s.eqGain, t);
  surroundNode.parameters.get('delayTime')?.setValueAtTime(s.delayTime, t);
  surroundNode.parameters.get('surroundGain')?.setValueAtTime(s.surroundGain, t);
  surroundNode.parameters.get('outputGain')?.setValueAtTime(s.outputGain, t);
  surroundNode.parameters.get('bypass')?.setValueAtTime(currentSurroundEnabled ? 0 : 1, t);
}

export function setSurroundParam(key: keyof SurroundParams, value: number): void {
  currentSurroundParams = { ...currentSurroundParams, [key]: value };
  applySurroundParams();
}

export function setSurroundParams(params: Partial<SurroundParams>): void {
  currentSurroundParams = { ...currentSurroundParams, ...params };
  applySurroundParams();
}

export function toggleSurround(enabled: boolean): void {
  currentSurroundEnabled = enabled;
  applySurroundParams();
}

export function getSurroundParams(): SurroundParams {
  return { ...currentSurroundParams };
}

export function isSurroundEnabled(): boolean {
  return currentSurroundEnabled;
}

/* ========== Spectrum ========== */
export function getSpectrumInput(): Uint8Array | null {
  if (!analyserIn) return null;
  const buf = new Uint8Array(analyserIn.frequencyBinCount);
  analyserIn.getByteFrequencyData(buf);
  return buf;
}

export function getSpectrumOutput(): Uint8Array | null {
  if (!analyserOut) return null;
  const buf = new Uint8Array(analyserOut.frequencyBinCount);
  analyserOut.getByteFrequencyData(buf);
  return buf;
}

export function getFrequencyBinCount(): number {
  return analyserIn?.frequencyBinCount ?? 0;
}

/* ========== Response Curve ========== */
export function getFilterNodes(): BiquadFilterNode[] {
  return filters.filter(Boolean);
}

/* ========== Status ========== */
export function isEngineReady(): boolean {
  return initialized;
}

export function resumeContext(): void {
  if (ctx?.state === 'suspended') ctx.resume();
}
