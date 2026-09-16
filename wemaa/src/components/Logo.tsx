type LogoProps = {
  size?: "sm" | "lg";
};

const sizes = {
  sm: { badge: "h-12 w-12", script: "text-sm", caps: "text-[6px] mt-0.5" },
  lg: { badge: "h-16 w-16", script: "text-lg", caps: "text-[7px] mt-1" },
};

/** Emblème circulaire Wemaa Services — logo principal du site. */
export function Logo({ size = "sm" }: LogoProps) {
  const s = sizes[size];
  return (
    <span
      className={`flex shrink-0 flex-col items-center justify-center rounded-full border border-or/50 ${s.badge}`}
    >
      <span className={`font-serif italic leading-none text-ivoire ${s.script}`}>Wemaa</span>
      <span className={`font-sans tracking-[0.25em] text-or ${s.caps}`}>SERVICES</span>
    </span>
  );
}
