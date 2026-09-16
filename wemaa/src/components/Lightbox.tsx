import { useEffect } from "react";
import type { PortfolioImage } from "../data/images";
import { Img } from "./Img";

type LightboxProps = {
  images: PortfolioImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
};

export function Lightbox({ images, index, onClose, onNavigate }: LightboxProps) {
  const current = images[index];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((index + 1) % images.length);
      if (e.key === "ArrowLeft") onNavigate((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [index, images.length, onClose, onNavigate]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-noir/95 backdrop-blur-sm animate-[fade-in_0.25s_ease]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute right-6 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-ivoire/20 text-xl text-ivoire transition-colors hover:border-or hover:text-or"
      >
        ×
      </button>

      <button
        type="button"
        aria-label="Photo précédente"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index - 1 + images.length) % images.length);
        }}
        className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-ivoire/20 text-xl text-ivoire transition-colors hover:border-or hover:text-or sm:left-6"
      >
        ‹
      </button>

      <figure
        className="mx-4 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-[4/3] max-h-[75vh] w-full overflow-hidden rounded-lg sm:aspect-[16/10]">
          <Img
            src={current.src}
            alt={current.alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <figcaption className="mt-4 flex items-center justify-between text-sm text-ivoire/60">
          <span className="tracking-wide text-or">{current.category}</span>
          <span>
            {index + 1} / {images.length}
          </span>
        </figcaption>
      </figure>

      <button
        type="button"
        aria-label="Photo suivante"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate((index + 1) % images.length);
        }}
        className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-ivoire/20 text-xl text-ivoire transition-colors hover:border-or hover:text-or sm:right-6"
      >
        ›
      </button>
    </div>
  );
}
