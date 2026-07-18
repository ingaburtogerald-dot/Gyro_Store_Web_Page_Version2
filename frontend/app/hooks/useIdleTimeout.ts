import { useEffect, useRef } from "react";

interface UseIdleTimeoutOptions {
  minutes: number;
  onIdle: () => void;
  isActive?: boolean;
}

export function useIdleTimeout({ minutes, onIdle, isActive = true }: UseIdleTimeoutOptions) {
  const onIdleRef = useRef(onIdle);

  // Mantenemos la referencia más reciente del callback para no reiniciar el timer si cambia
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!isActive) return;

    let timeoutId: number;
    const timeoutMs = minutes * 60 * 1000;
    
    // Cooldown (throttle) para no llamar a resetTimer en cada píxel que se mueva el mouse
    let lastActivity = Date.now();
    const COOLDOWN_MS = 1000; // 1 segundo

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        onIdleRef.current();
      }, timeoutMs);
    };

    const handleActivity = () => {
      const now = Date.now();
      // Solo reiniciar el timer si ha pasado más del cooldown
      if (now - lastActivity > COOLDOWN_MS) {
        lastActivity = now;
        resetTimer();
      }
    };

    // Configuración inicial
    resetTimer();

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    
    // Usamos passive: true para mejorar el rendimiento, ya que no llamaremos preventDefault()
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup al desmontar o cuando cambia isActive/minutes
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [minutes, isActive]);
}
