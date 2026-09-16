import { useState, type ImgHTMLAttributes } from "react";

type ImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  alt: string;
};

/**
 * <img> avec repli élégant si la photo ne charge pas (utile tant que les
 * visuels de démonstration ne sont pas remplacés par les vraies photos
 * Wemaa Services).
 */
export function Img({ src, alt, className = "", ...rest }: ImgProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-noir-soft via-noir to-noir-soft ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-or/20 font-serif text-sm text-or/30">
          W
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
}
