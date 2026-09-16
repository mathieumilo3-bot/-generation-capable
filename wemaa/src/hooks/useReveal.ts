import { useEffect, useRef } from "react";

/**
 * Ajoute la classe "is-visible" (voir .reveal dans index.css) dès qu'un
 * élément entre dans le viewport. Léger, sans dépendance, désactivable
 * via prefers-reduced-motion (géré en CSS).
 */
export function useReveal<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px", ...options },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options]);

  return ref;
}
