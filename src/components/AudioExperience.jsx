import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const AudioExperienceContext = createContext({ enabled: true, toggle: () => {} });
const isCasePath = (pathname) => /^\/student\/cases\/[^/]+\/?$/.test(pathname);

export function AudioExperienceProvider({ children }) {
  const { pathname } = useLocation();
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('pulselab-audio-enabled') !== 'false'; } catch { return true; }
  });
  const audioRef = useRef(null);
  const enabledRef = useRef(enabled);
  const pathnameRef = useRef(pathname);
  const unlockedRef = useRef(false);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  const getAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    const context = new AudioCtor();
    const master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
    audioRef.current = { context, master, ambience: null, monitorTimer: null };
    return audioRef.current;
  }, []);

  const playTone = useCallback((frequency, duration = 0.09, volume = 0.12, type = 'sine') => {
    const audio = getAudio();
    if (!audio || !enabledRef.current) return;
    const { context, master } = audio;
    if (context.state === 'suspended') context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.02);
  }, [getAudio]);

  const stopLoops = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.monitorTimer) window.clearInterval(audio.monitorTimer);
    audio.monitorTimer = null;
    if (audio.ambience) {
      audio.ambience.forEach(({ oscillator, gain }) => {
        try {
          gain.gain.cancelScheduledValues(audio.context.currentTime);
          gain.gain.setTargetAtTime(0, audio.context.currentTime, 0.2);
          oscillator.stop(audio.context.currentTime + 1);
        } catch { /* already stopped */ }
      });
      audio.ambience = null;
    }
  }, []);

  const startAmbience = useCallback(() => {
    const audio = getAudio();
    if (!audio || audio.ambience || !enabledRef.current) return;
    const { context, master } = audio;
    audio.ambience = [220, 261.63, 329.63].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      gain.gain.setTargetAtTime(index === 0 ? 0.06 : 0.035, context.currentTime, 2 + index);
      return { oscillator, gain };
    });
  }, [getAudio]);

  const startMonitor = useCallback(() => {
    const audio = getAudio();
    if (!audio || audio.monitorTimer || !enabledRef.current) return;
    playTone(880, 0.12, 0.16, 'sine');
    audio.monitorTimer = window.setInterval(() => playTone(880, 0.12, 0.16, 'sine'), 1000);
  }, [getAudio, playTone]);

  useEffect(() => {
    if (!enabled) { stopLoops(); return; }
    if (!unlockedRef.current) return;
    stopLoops();
    if (isCasePath(pathname)) startMonitor();
    else if (pathname.startsWith('/student/')) startAmbience();
  }, [enabled, pathname, startAmbience, startMonitor, stopLoops]);

  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      const audio = getAudio();
      if (audio?.context.state === 'suspended') audio.context.resume();
      if (!enabledRef.current) return;
      if (isCasePath(pathnameRef.current)) startMonitor();
      else if (pathnameRef.current.startsWith('/student/')) startAmbience();
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      stopLoops();
      if (audioRef.current) audioRef.current.context.close();
    };
  }, [getAudio, startAmbience, startMonitor, stopLoops]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!enabledRef.current || !event.target.closest('button, [role="button"]')) return;
      playTone(660, 0.055, 0.1, 'triangle');
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [playTone]);

  const toggle = () => {
    setEnabled((current) => {
      const next = !current;
      try { localStorage.setItem('pulselab-audio-enabled', String(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };

  return (
    <AudioExperienceContext.Provider value={{ enabled, toggle }}>
      {children}
    </AudioExperienceContext.Provider>
  );
}

export function useAudioExperience() {
  return useContext(AudioExperienceContext);
}
