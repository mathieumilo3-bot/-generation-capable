import { useEffect, useRef, useState } from "react";

/**
 * Anime la partie numérique d'une valeur du type "300+", "100%", "24/7"
 * une fois que l'élément est visible à l'écran. Le préfixe/suffixe non
 * numérique est conservé tel quel.
 */
export function useCountUp<T extends HTMLElement>(value: string, durationMs = 1400) {
  const match = value.match(/\d+/);
  const target = match ? Number(match[0]) : null;
  const [display, setDisplay] = useState(target === null ? value : value.replace(/\d+/, "0"));
  const ref = useRef<T | null>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || target === null || started.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || started.current) return;
        started.current = true;

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min((now - start) / durationMs, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(target * eased);
          setDisplay(value.replace(/\d+/, String(current)));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        observer.disconnect();
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [target, value, durationMs]);

  return { ref, display };
}
