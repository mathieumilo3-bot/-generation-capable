"use client";

import { useState } from "react";
import type { Motif as MotifName } from "@/lib/preview-engine/trades";
import { Motif } from "./Motif";

/**
 * Every photo sits in a box whose ratio is fixed by CSS, so it can never
 * shift the layout; it is lazy-loaded, and if it fails to load the box keeps
 * its place and shows the quiet motif instead of a broken image.
 */
export function PreviewImage({
  src,
  alt,
  className,
  motif,
  id,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  motif: MotifName;
  id: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className={`gcp-media ${className ?? ""}`} style={{ margin: 0 }}>
      {failed ? (
        <Motif name={motif} id={`fallback-${id}`} className="gcp-media__fallback" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- proxied third-party photo, ratio fixed by the container
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
          sizes="(max-width: 860px) 100vw, 50vw"
          onError={() => setFailed(true)}
        />
      )}
    </figure>
  );
}
