import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initAudioEngine,
  connectAudioSource,
  setEqBand,
  applyEqPreset,
  resetEq,
  setPreamp,
  setLimiter,
  setSurroundParam,
  setSurroundParams,
  toggleSurround,
  getEqBands,
  getSurroundParams,
  isSurroundEnabled,
  getSpectrumInput,
  getSpectrumOutput,
  getFrequencyBinCount,
  getFilterNodes,
  isEngineReady,
  resumeContext,
  type EqBandConfig,
  type SurroundParams,
} from '@/audio/engine';
import { globalAudio } from '@/stores/audioStore';

export function useAudioEngine() {
  const [ready, setReady] = useState(isEngineReady());
  const [eqBands, setEqBandsState] = useState<EqBandConfig[]>(getEqBands);
  const [preamp, setPreampState] = useState(-1);
  const [limiterOn, setLimiterOnState] = useState(true);
  const [surroundEnabled, setSurroundEnabledState] = useState(isSurroundEnabled());
  const [surroundParams, setSurroundParamsState] = useState<SurroundParams>(getSurroundParams());
  const [status, setStatus] = useState('');
  const animFrameRef = useRef<number>(0);

  // Initialize engine on mount
  useEffect(() => {
    initAudioEngine()
      .then(() => {
        setReady(true);
        setStatus('音频引擎已就绪');
      })
      .catch(() => {
        setStatus('音频引擎初始化失败');
      });
  }, []);

  // Connect source when audio starts playing
  useEffect(() => {
    const onPlay = () => {
      connectAudioSource();
      resumeContext();
    };
    globalAudio.addEventListener('play', onPlay);
    return () => globalAudio.removeEventListener('play', onPlay);
  }, []);

  // EQ controls
  const updateEqBand = useCallback((index: number, patch: Partial<EqBandConfig>) => {
    setEqBand(index, patch);
    setEqBandsState(getEqBands());
  }, []);

  const applyPreset = useCallback((name: string) => {
    applyEqPreset(name);
    setEqBandsState(getEqBands());
  }, []);

  const resetEqBands = useCallback(() => {
    resetEq();
    setEqBandsState(getEqBands());
  }, []);

  // Preamp / Limiter
  const updatePreamp = useCallback((value: number) => {
    setPreamp(value);
    setPreampState(value);
  }, []);

  const updateLimiter = useCallback((enabled: boolean) => {
    setLimiter(enabled);
    setLimiterOnState(enabled);
  }, []);

  // Surround controls
  const updateSurroundParam = useCallback((key: keyof SurroundParams, value: number) => {
    setSurroundParam(key, value);
    setSurroundParamsState(getSurroundParams());
  }, []);

  const updateSurroundParams = useCallback((params: Partial<SurroundParams>) => {
    setSurroundParams(params);
    setSurroundParamsState(getSurroundParams());
  }, []);

  const toggleSurroundState = useCallback((enabled: boolean) => {
    toggleSurround(enabled);
    setSurroundEnabledState(isSurroundEnabled());
    setSurroundParamsState(getSurroundParams());
  }, []);

  // Spectrum data
  const getSpectrumData = useCallback(() => {
    return {
      input: getSpectrumInput(),
      output: getSpectrumOutput(),
      binCount: getFrequencyBinCount(),
    };
  }, []);

  const getFilters = useCallback(() => getFilterNodes(), []);

  return {
    ready,
    status,
    eqBands,
    preamp,
    limiterOn,
    surroundEnabled,
    surroundParams,
    updateEqBand,
    applyPreset,
    resetEqBands,
    updatePreamp,
    updateLimiter,
    updateSurroundParam,
    updateSurroundParams,
    toggleSurroundState,
    getSpectrumData,
    getFilters,
    resumeContext,
  };
}
