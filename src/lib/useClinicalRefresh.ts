"use client";
import { useEffect, useRef } from "react";

export function useClinicalRefresh(refresh: () => void | Promise<void>, interval = 10000) {
  const callback = useRef(refresh);
  useEffect(() => { callback.current = refresh; }, [refresh]);
  useEffect(() => {
    let running = false, again = false, active = true;
    const update = async () => {
      if (!active || document.visibilityState === "hidden") return;
      if (running) { again = true; return; }
      running = true;
      try { await callback.current(); } finally { running = false; if (again && active) { again = false; void update(); } }
    };
    const handler = () => { void update(); };
    const timer = window.setInterval(handler, interval);
    window.addEventListener("tricare:clinical-change", handler);
    window.addEventListener("focus", handler);
    document.addEventListener("visibilitychange", handler);
    return () => {active=false;window.clearInterval(timer);window.removeEventListener("tricare:clinical-change",handler);window.removeEventListener("focus",handler);document.removeEventListener("visibilitychange",handler);};
  }, [interval]);
}
