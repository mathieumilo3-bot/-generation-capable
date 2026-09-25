import type { ReactNode } from "react";
import type { SceneId } from "@/lib/demos/clos-et-cadre/projects";

/**
 * Architectural plates for the Clos & Cadre demonstration.
 *
 * The demo has no real site photographs, and inventing some would break the
 * one rule it is built on. So each project is drawn the way an architecture
 * practice presents a project before the photographer comes: an elevation or
 * a plan, existing state vs. delivered state, with a title block. On a real
 * deployment these plates sit next to the site photos, they don't replace
 * them — see the "photographies" slot on each project page.
 *
 * Every plate is pure SVG (no request, no layout shift), and every id inside
 * is prefixed with `uid` so two plates can share a page — the before/after
 * slider stacks two of them.
 */

export type DrawingState = "before" | "after";

const C = {
  paper: "#F1ECE4",
  sky: "#E8E2D7",
  ink: "#2A2724",
  inkSoft: "#6B645B",
  ground: "#D9CFBF",
  lawn: "#B9B596",
  stone: "#CDAE86",
  stoneDark: "#AE8A60",
  brick: "#A5583D",
  render: "#E7E0D3",
  renderOld: "#D6C7A8",
  larch: "#B6865A",
  larchDark: "#8E6340",
  zinc: "#8D9197",
  zincDark: "#6E7278",
  tile: "#9C5C45",
  tileDark: "#7C4533",
  frame: "#F4F1EA",
  frameDark: "#33322F",
  glass: "#7E9095",
  warm: "#EBCB91",
  leaf: "#8C9676",
  leafLight: "#A9B191",
} as const;

/** Deterministic pseudo-random generator so the server and client render identical stones. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function stonePolygons(seed: number, width: number, height: number) {
  const random = seeded(seed);
  const stones: string[] = [];
  for (let y = 0; y < height; y += 14) {
    let x = -random() * 12;
    while (x < width) {
      const w = 12 + random() * 16;
      const h = 9 + random() * 6;
      const jitter = () => (random() - 0.5) * 3;
      const points = [
        [x + jitter(), y + jitter()],
        [x + w + jitter(), y + jitter()],
        [x + w + jitter(), y + h + jitter()],
        [x + jitter(), y + h + jitter()],
      ]
        .map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`)
        .join(" ");
      stones.push(points);
      x += w + 2 + random() * 3;
    }
  }
  return stones;
}

function Defs({ uid }: { uid: string }) {
  const stones = stonePolygons(7, 120, 84);
  return (
    <defs>
      <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#EAE5DC" />
        <stop offset="1" stopColor={C.paper} />
      </linearGradient>
      <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#95A7AB" />
        <stop offset="0.55" stopColor={C.glass} />
        <stop offset="1" stopColor="#5E6F74" />
      </linearGradient>
      <linearGradient id={`${uid}-warm`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F1D9A8" />
        <stop offset="1" stopColor="#D9B47A" />
      </linearGradient>
      <pattern id={`${uid}-meuliere`} width="120" height="84" patternUnits="userSpaceOnUse">
        <rect width="120" height="84" fill={C.stoneDark} />
        {stones.map((points, index) => (
          <polygon key={index} points={points} fill={index % 3 === 0 ? "#C8A57A" : index % 3 === 1 ? C.stone : "#D6BA93"} />
        ))}
      </pattern>
      <pattern id={`${uid}-larch`} width="9" height="40" patternUnits="userSpaceOnUse">
        <rect width="9" height="40" fill={C.larch} />
        <rect x="7" width="2" height="40" fill={C.larchDark} />
        <rect x="2" y="6" width="1" height="18" fill="#C4966A" opacity="0.6" />
      </pattern>
      <pattern id={`${uid}-tiles`} width="16" height="10" patternUnits="userSpaceOnUse">
        <rect width="16" height="10" fill={C.tile} />
        <path d="M0 9.5 H16" stroke={C.tileDark} strokeWidth="1" />
        <path d="M8 0 V9.5" stroke={C.tileDark} strokeWidth="0.6" opacity="0.6" />
      </pattern>
      <pattern id={`${uid}-zinc`} width="14" height="20" patternUnits="userSpaceOnUse">
        <rect width="14" height="20" fill={C.zinc} />
        <rect x="12.6" width="1.4" height="20" fill={C.zincDark} />
      </pattern>
      <pattern id={`${uid}-crepi`} width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill={C.renderOld} />
        <circle cx="2" cy="3" r="0.7" fill="#C4B393" />
        <circle cx="6" cy="6" r="0.6" fill="#C4B393" />
      </pattern>
      <pattern id={`${uid}-parquet`} width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="24" height="24" fill="#E4D6BF" />
        <path d="M0 0 V24 M12 0 V24" stroke="#D3C1A3" strokeWidth="1" />
      </pattern>
      <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill={C.paper} />
        <path d="M0 0 V6" stroke={C.inkSoft} strokeWidth="1" opacity="0.5" />
      </pattern>
    </defs>
  );
}

function Window({
  x,
  y,
  w,
  h,
  uid,
  frame = C.frame,
  mullion = true,
  lit = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  uid: string;
  frame?: string;
  mullion?: boolean;
  lit?: boolean;
}) {
  const f = Math.max(2.5, Math.min(w, h) * 0.07);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={frame} />
      <rect x={x + f} y={y + f} width={w - f * 2} height={h - f * 2} fill={lit ? `url(#${uid}-warm)` : `url(#${uid}-glass)`} />
      {mullion && <rect x={x + w / 2 - f / 2} y={y + f} width={f} height={h - f * 2} fill={frame} />}
      <path
        d={`M${x + f + (w - 2 * f) * 0.15} ${y + h - f} L${x + f + (w - 2 * f) * 0.55} ${y + f}`}
        stroke="#FFFFFF"
        strokeOpacity={lit ? 0.18 : 0.28}
        strokeWidth={Math.max(2, w * 0.06)}
      />
    </g>
  );
}

function Tree({ x, y, r, tone = C.leaf }: { x: number; y: number; r: number; tone?: string }) {
  return (
    <g opacity="0.92">
      <rect x={x - r * 0.05} y={y} width={r * 0.1} height={r * 1.4} fill={C.inkSoft} opacity="0.55" />
      <circle cx={x} cy={y} r={r} fill={tone} opacity="0.75" />
      <circle cx={x - r * 0.55} cy={y + r * 0.25} r={r * 0.65} fill={C.leafLight} opacity="0.7" />
      <circle cx={x + r * 0.5} cy={y + r * 0.2} r={r * 0.7} fill={tone} opacity="0.65" />
    </g>
  );
}

function Shrub({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <ellipse cx={x + w / 2} cy={y} rx={w / 2} ry={w * 0.28} fill={C.leaf} opacity="0.8" />
      <ellipse cx={x + w * 0.35} cy={y - w * 0.08} rx={w * 0.28} ry={w * 0.2} fill={C.leafLight} opacity="0.8" />
    </g>
  );
}

function Ground({ lawn = true }: { lawn?: boolean }) {
  return (
    <g>
      <rect x="0" y="640" width="1200" height="160" fill={C.ground} />
      {lawn && <rect x="0" y="640" width="1200" height="10" fill={C.lawn} />}
      <path d="M0 640 H1200" stroke={C.ink} strokeWidth="2" />
    </g>
  );
}

function TitleBlock({ place, view, state, frame }: { place: string; view: string; state: DrawingState; frame: Frame }) {
  const left = frame.x + 28;
  const bottom = frame.y + frame.h;
  return (
    <g fontFamily="var(--font-cc-sans), ui-sans-serif, system-ui" fill={C.ink} className="max-sm:hidden">
      <text x={left} y={bottom - 42} fontSize="15" letterSpacing="3" fontWeight="600">
        {place.toUpperCase()}
      </text>
      <text x={left} y={bottom - 20} fontSize="13" letterSpacing="2" fill={C.inkSoft}>
        {view.toUpperCase()} — {state === "before" ? "ÉTAT EXISTANT" : "ÉTAT LIVRÉ"}
      </text>
      <g transform={`translate(${frame.x + frame.w - 196} ${bottom - 50})`}>
        <rect x="0" y="0" width="40" height="6" fill={C.ink} />
        <rect x="40" y="0" width="40" height="6" fill="none" stroke={C.ink} strokeWidth="1.2" />
        <rect x="80" y="0" width="80" height="6" fill={C.ink} />
        <text x="0" y="24" fontSize="11" fill={C.inkSoft}>0</text>
        <text x="36" y="24" fontSize="11" fill={C.inkSoft}>1</text>
        <text x="76" y="24" fontSize="11" fill={C.inkSoft}>2</text>
        <text x="148" y="24" fontSize="11" fill={C.inkSoft}>4 m</text>
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------------ */

function Meuliere({ uid, state }: { uid: string; state: DrawingState }) {
  const after = state === "after";
  return (
    <>
      <Tree x={250} y={330} r={120} />
      <Tree x={1010} y={380} r={95} tone={C.leafLight} />
      {/* main house */}
      <polygon points="300,384 790,384 700,232 390,232" fill={`url(#${uid}-tiles)`} stroke={C.ink} strokeWidth="2" />
      <rect x="612" y="196" width="34" height="60" fill={C.brick} stroke={C.ink} strokeWidth="1.5" />
      <rect x="318" y="384" width="454" height="12" fill={C.frame} stroke={C.ink} strokeWidth="1.5" />
      <rect x="330" y="396" width="430" height="244" fill={`url(#${uid}-meuliere)`} stroke={C.ink} strokeWidth="2" />
      <rect x="330" y="616" width="430" height="24" fill="#BFA27C" stroke={C.ink} strokeWidth="1" />
      <rect x="330" y="512" width="430" height="7" fill={C.brick} opacity="0.85" />
      {/* upper windows with brick lintels */}
      {[372, 522, 672].map((x) => (
        <g key={x}>
          <rect x={x - 6} y={414} width={58} height={8} fill={C.brick} />
          <Window x={x} y={422} w={46} h={66} uid={uid} />
          <rect x={x - 4} y={488} width={54} height={5} fill={C.frame} />
        </g>
      ))}
      {/* ground floor, left part (unchanged) */}
      <rect x="366" y="534" width="58" height="8" fill={C.brick} />
      <Window x={372} y={542} w={46} h={66} uid={uid} />
      {after ? (
        <>
          {/* extension: flat roof, larch cladding, 4.80 m slider */}
          <rect x="530" y="506" width="400" height="134" fill={`url(#${uid}-larch)`} stroke={C.ink} strokeWidth="2" />
          <rect x="524" y="498" width="412" height="10" fill={C.zinc} stroke={C.ink} strokeWidth="1.5" />
          <rect x="584" y="528" width="200" height="112" fill={C.frameDark} />
          <rect x="589" y="533" width="190" height="107" fill={`url(#${uid}-warm)`} />
          <rect x="682" y="533" width="4" height="107" fill={C.frameDark} />
          {/* interior glimpse */}
          <path d="M630 533 V566" stroke={C.ink} strokeWidth="1" opacity="0.6" />
          <ellipse cx="630" cy="570" rx="12" ry="5" fill={C.ink} opacity="0.75" />
          <path d="M735 533 V560" stroke={C.ink} strokeWidth="1" opacity="0.6" />
          <ellipse cx="735" cy="564" rx="12" ry="5" fill={C.ink} opacity="0.75" />
          <rect x="612" y="604" width="150" height="36" fill="#CDB38C" opacity="0.9" />
          <rect x="608" y="600" width="158" height="6" fill="#F5F0E6" opacity="0.95" />
          <path d="M600 640 L660 533" stroke="#FFFFFF" strokeOpacity="0.22" strokeWidth="10" />
          <Window x={830} y={548} w={58} h={60} uid={uid} frame={C.frameDark} mullion={false} />
          {/* terrace */}
          <rect x="520" y="640" width="430" height="10" fill="#A98C6A" />
          <path d="M520 645 H950" stroke={C.larchDark} strokeWidth="0.8" strokeDasharray="22 3" />
          <Shrub x={960} y={632} w={80} />
        </>
      ) : (
        <>
          {/* ground floor rear wall with small kitchen window */}
          <rect x="560" y="534" width="58" height="8" fill={C.brick} />
          <Window x={566} y={542} w={46} h={52} uid={uid} />
          {/* 1990s veranda */}
          <polygon points="600,520 900,548 900,640 600,640" fill="#DCE3E2" opacity="0.8" />
          <polygon points="600,520 900,548 900,556 600,528" fill="#C9CFCC" stroke={C.inkSoft} strokeWidth="1.5" />
          {[600, 660, 720, 780, 840, 900].map((x) => (
            <rect key={x} x={x - 2} y={x === 600 ? 520 : 520 + ((x - 600) / 300) * 28} width="4" height={640 - (520 + ((x - 600) / 300) * 28)} fill="#FBFBF8" stroke={C.inkSoft} strokeWidth="0.8" />
          ))}
          <path d="M600 596 H900" stroke="#FBFBF8" strokeWidth="3" />
          <path d="M640 548 L700 610 M760 560 L800 600" stroke={C.inkSoft} strokeOpacity="0.25" strokeWidth="6" />
          <Shrub x={920} y={634} w={70} />
        </>
      )}
      <Shrub x={300} y={636} w={70} />
    </>
  );
}

function Pavillon({ uid, state }: { uid: string; state: DrawingState }) {
  const after = state === "after";
  const wall = after ? C.render : `url(#${uid}-crepi)`;
  return (
    <>
      <Tree x={180} y={390} r={100} tone={C.leafLight} />
      <Tree x={1050} y={360} r={115} />
      {/* hipped roof */}
      <polygon points="330,468 870,468 760,330 440,330" fill={`url(#${uid}-tiles)`} stroke={C.ink} strokeWidth="2" />
      {after ? (
        <rect x="326" y="466" width="548" height="8" fill={C.zinc} stroke={C.ink} strokeWidth="1" />
      ) : (
        <rect x="326" y="466" width="548" height="6" fill="#BDBAB2" stroke={C.ink} strokeWidth="1" />
      )}
      {/* raised ground floor over a basement */}
      <rect x="350" y="474" width="500" height="120" fill={wall} stroke={C.ink} strokeWidth="2" />
      <rect x="350" y="594" width="500" height="46" fill={after ? "#D8D0C1" : "#C9BB9D"} stroke={C.ink} strokeWidth="2" />
      {after ? (
        <>
          {[392, 482].map((x) => (
            <Window key={x} x={x} y={494} w={60} h={96} uid={uid} frame={C.frameDark} />
          ))}
          <Window x={660} y={494} w={150} h={96} uid={uid} frame={C.frameDark} lit />
          <rect x="566" y="500" width="54" height="94" fill="#6F5A45" stroke={C.ink} strokeWidth="1.5" />
          <path d="M575 500 V594 M584 500 V594 M593 500 V594 M602 500 V594 M611 500 V594" stroke="#5B4938" strokeWidth="1" />
          {/* garage door, vertical timber */}
          <rect x="690" y="604" width="120" height="36" fill={`url(#${uid}-larch)`} stroke={C.ink} strokeWidth="1.5" />
          {/* steps */}
          <path d="M556 640 H632 V630 H622 V620 H612 V610 H604 V598 H584 V610 H576 V620 H566 V630 H556 Z" fill="#CFC6B6" stroke={C.ink} strokeWidth="1" />
          <Shrub x={360} y={636} w={120} />
          <Shrub x={830} y={634} w={70} />
        </>
      ) : (
        <>
          {[390, 480, 690, 770].map((x) => (
            <g key={x}>
              <rect x={x} y={500} width={48} height={12} fill="#D2CCBE" stroke={C.inkSoft} strokeWidth="1" />
              <Window x={x + 2} y={512} w={44} h={52} uid={uid} />
            </g>
          ))}
          <rect x="574" y="506" width="46" height="88" fill="#B79E7A" stroke={C.ink} strokeWidth="1.5" />
          <rect x="582" y="516" width="30" height="24" fill={`url(#${uid}-glass)`} />
          <rect x="690" y="604" width="120" height="36" fill="#C2AE8A" stroke={C.ink} strokeWidth="1.5" />
          {[612, 620, 628].map((y) => (
            <path key={y} d={`M690 ${y} H810`} stroke={C.inkSoft} strokeWidth="0.8" />
          ))}
          <path d="M560 640 H634 V628 H624 V616 H614 V604 H606 V594 H588 V604 H580 V616 H570 V628 H560 Z" fill="#BDB3A2" stroke={C.ink} strokeWidth="1" />
          <Shrub x={380} y={636} w={60} />
        </>
      )}
    </>
  );
}

function Surelevation({ uid, state }: { uid: string; state: DrawingState }) {
  const after = state === "after";
  return (
    <>
      <Tree x={200} y={400} r={105} />
      <Tree x={1030} y={420} r={85} tone={C.leafLight} />
      {/* ground floor */}
      <rect x="380" y="520" width="440" height="120" fill={after ? C.render : `url(#${uid}-crepi)`} stroke={C.ink} strokeWidth="2" />
      <Window x={420} y={548} w={56} h={64} uid={uid} frame={after ? C.frameDark : C.frame} />
      <rect x="530" y="542" width="50" height="98" fill={after ? "#6F5A45" : "#B79E7A"} stroke={C.ink} strokeWidth="1.5" />
      <Window x={630} y={548} w={140} h={64} uid={uid} frame={after ? C.frameDark : C.frame} lit={after} />
      {after ? (
        <>
          <rect x="376" y="514" width="448" height="8" fill="#BDB5A6" stroke={C.ink} strokeWidth="1" />
          {/* new timber-framed floor */}
          <rect x="380" y="400" width="440" height="114" fill={`url(#${uid}-larch)`} stroke={C.ink} strokeWidth="2" />
          <Window x={420} y={424} w={70} h={80} uid={uid} frame={C.frameDark} />
          <Window x={640} y={424} w={130} h={80} uid={uid} frame={C.frameDark} lit />
          {/* low zinc roof */}
          <polygon points="366,400 834,400 834,382 366,368" fill={`url(#${uid}-zinc)`} stroke={C.ink} strokeWidth="2" />
          <Shrub x={390} y={636} w={90} />
          <Shrub x={760} y={634} w={70} />
        </>
      ) : (
        <>
          <polygon points="360,520 840,520 600,418" fill={`url(#${uid}-tiles)`} stroke={C.ink} strokeWidth="2" />
          <rect x="690" y="432" width="26" height="50" fill={C.brick} stroke={C.ink} strokeWidth="1.2" />
          <Shrub x={400} y={636} w={60} />
        </>
      )}
    </>
  );
}

/* Floor plan of the Saint-Germain flat. Poché walls, room labels, beam. */
function Appartement({ uid, state }: { uid: string; state: DrawingState }) {
  const after = state === "after";
  const wall = (d: string, width = 8) => <path d={d} stroke={C.ink} strokeWidth={width} strokeLinecap="square" fill="none" />;
  const label = (x: number, y: number, name: string, area: string) => (
    <g fontFamily="var(--font-cc-sans), ui-sans-serif, system-ui" textAnchor="middle">
      <text x={x} y={y} fontSize="15" letterSpacing="2" fill={C.ink} fontWeight="600">
        {name.toUpperCase()}
      </text>
      <text x={x} y={y + 18} fontSize="12" fill={C.inkSoft}>
        {area}
      </text>
    </g>
  );
  const door = (x: number, y: number, r: number, rotate: number) => (
    <path d={`M${x} ${y} h${r} a${r} ${r} 0 0 1 ${-r} ${r} Z`} transform={`rotate(${rotate} ${x} ${y})`} fill="none" stroke={C.inkSoft} strokeWidth="1.2" />
  );
  const windowsTop = [210, 400, 590, 780, 970];
  const windowsBottom = [260, 520, 800, 990];
  return (
    <>
      <rect x="120" y="120" width="960" height="500" fill={after ? C.paper : "#EEE8DE"} />
      {after && <rect x="124" y="124" width="584" height="232" fill={`url(#${uid}-parquet)`} opacity="0.9" />}
      {/* exterior walls, street side on top, courtyard below */}
      {wall("M120 120 H1080 V620 H120 Z", 16)}
      {windowsTop.map((x) => (
        <g key={x}>
          <rect x={x - 32} y="112" width="64" height="16" fill={C.paper} />
          <path d={`M${x - 32} 116 H${x + 32} M${x - 32} 124 H${x + 32}`} stroke={C.ink} strokeWidth="1.5" />
        </g>
      ))}
      {windowsBottom.map((x) => (
        <g key={x}>
          <rect x={x - 28} y="612" width="56" height="16" fill={C.paper} />
          <path d={`M${x - 28} 616 H${x + 28} M${x - 28} 624 H${x + 28}`} stroke={C.ink} strokeWidth="1.5" />
        </g>
      ))}
      <text x="600" y="96" textAnchor="middle" fontSize="12" letterSpacing="3" fill={C.inkSoft} fontFamily="var(--font-cc-sans), ui-sans-serif">
        CÔTÉ RUE
      </text>
      <text x="600" y="652" textAnchor="middle" fontSize="12" letterSpacing="3" fill={C.inkSoft} fontFamily="var(--font-cc-sans), ui-sans-serif">
        CÔTÉ COUR
      </text>

      {after ? (
        <>
          {/* refend opened under a steel beam */}
          {wall("M420 120 V250", 12)}
          <path d="M420 250 V356" stroke={C.ink} strokeWidth="2" strokeDasharray="8 6" />
          <rect x="404" y="244" width="32" height="12" fill={C.ink} />
          <text x="432" y="300" fontSize="12" fill={C.brick} fontFamily="var(--font-cc-sans), ui-sans-serif" letterSpacing="1">
            POUTRE ACIER
          </text>
          {/* bedrooms and bathrooms grouped on the courtyard side */}
          {wall("M120 360 H1080", 6)}
          {wall("M708 120 V360", 6)}
          {wall("M400 360 V620", 6)}
          {wall("M660 360 V620", 6)}
          {wall("M880 360 V620", 6)}
          {wall("M880 490 H1080", 6)}
          {/* openings */}
          <rect x="300" y="354" width="60" height="12" fill={C.paper} />
          <rect x="560" y="354" width="60" height="12" fill={C.paper} />
          <rect x="770" y="354" width="60" height="12" fill={C.paper} />
          <rect x="702" y="200" width="12" height="70" fill={C.paper} />
          {door(300, 366, 60, 0)}
          {door(560, 366, 60, 0)}
          {door(770, 366, 60, 0)}
          {/* kitchen island + table + sofa */}
          <rect x="190" y="200" width="150" height="46" fill="none" stroke={C.inkSoft} strokeWidth="1.5" />
          <rect x="140" y="140" width="260" height="30" fill="none" stroke={C.inkSoft} strokeWidth="1.2" />
          <circle cx="560" cy="232" r="34" fill="none" stroke={C.inkSoft} strokeWidth="1.5" />
          <rect x="548" y="296" width="130" height="42" rx="6" fill="none" stroke={C.inkSoft} strokeWidth="1.5" />
          {label(260, 300, "Cuisine ouverte", "")}
          {label(580, 150, "Séjour", "48 m² avec la cuisine")}
          {label(890, 240, "Entrée", "et bureau")}
          {label(260, 500, "Chambre", "14 m²")}
          {label(530, 500, "Chambre", "12 m²")}
          {label(770, 500, "Chambre", "12 m²")}
          {label(980, 430, "Bains", "")}
          {label(980, 560, "Douche", "")}
        </>
      ) : (
        <>
          {/* original enfilade: refend + long corridor */}
          {wall("M420 120 V356", 12)}
          {wall("M120 330 H1080", 6)}
          {wall("M120 410 H1000", 6)}
          <rect x="124" y="334" width="956" height="72" fill={`url(#${uid}-hatch)`} opacity="0.35" />
          {wall("M260 120 V330", 6)}
          {wall("M640 120 V330", 6)}
          {wall("M860 120 V330", 6)}
          {wall("M330 410 V620", 6)}
          {wall("M560 410 V620", 6)}
          {wall("M760 410 V620", 6)}
          {wall("M900 410 V620", 6)}
          {[180, 330, 520, 740, 960].map((x) => (
            <rect key={`t${x}`} x={x} y="324" width="44" height="12" fill={C.paper} />
          ))}
          {[230, 440, 650, 820, 960].map((x) => (
            <rect key={`b${x}`} x={x} y="404" width="44" height="12" fill={C.paper} />
          ))}
          {label(190, 230, "Cuisine", "9 m²")}
          {label(340, 230, "Salle à manger", "")}
          {label(530, 230, "Séjour", "22 m²")}
          {label(750, 230, "Chambre", "13 m²")}
          {label(970, 230, "Chambre", "12 m²")}
          {label(600, 374, "Couloir", "11 m de long")}
          {label(225, 520, "Chambre", "11 m²")}
          {label(445, 520, "Bureau", "")}
          {label(660, 520, "Bains", "")}
          {label(830, 520, "WC", "")}
          {label(990, 520, "Entrée", "")}
        </>
      )}
      {/* north arrow */}
      <g transform="translate(1130 180)">
        <circle r="18" fill="none" stroke={C.ink} strokeWidth="1.2" />
        <path d="M0 -14 L6 8 L0 4 L-6 8 Z" fill={C.ink} />
        <text y="38" textAnchor="middle" fontSize="11" fill={C.inkSoft} fontFamily="var(--font-cc-sans), ui-sans-serif">N</text>
      </g>
    </>
  );
}

type Frame = { x: number; y: number; w: number; h: number };

/** Each plate is cropped on its building (16:10), so the house fills the frame. */
const FRAMES: Record<SceneId, Frame> = {
  meuliere: { x: 180, y: 160, w: 880, h: 550 },
  pavillon: { x: 184, y: 190, w: 832, h: 520 },
  surelevation: { x: 208, y: 220, w: 784, h: 490 },
  appartement: { x: 0, y: 0, w: 1200, h: 750 },
};

const SCENES: Record<SceneId, { place: string; view: string; render: (props: { uid: string; state: DrawingState }) => ReactNode }> = {
  meuliere: { place: "Chatou — maison en meulière", view: "Élévation jardin", render: (props) => <Meuliere {...props} /> },
  pavillon: { place: "Le Vésinet — pavillon 1972", view: "Élévation sur rue", render: (props) => <Pavillon {...props} /> },
  appartement: { place: "Saint-Germain-en-Laye — appartement", view: "Plan", render: (props) => <Appartement {...props} /> },
  surelevation: { place: "Rueil-Malmaison — pavillon 1958", view: "Élévation sur jardin", render: (props) => <Surelevation {...props} /> },
};

export function sceneCaption(scene: SceneId, state: DrawingState): string {
  const { place, view } = SCENES[scene];
  return `${view}, ${place} — ${state === "before" ? "état existant" : "état livré"}`;
}

export function Drawing({
  scene,
  state,
  uid,
  className = "",
  titleBlock = true,
}: {
  scene: SceneId;
  state: DrawingState;
  uid: string;
  className?: string;
  titleBlock?: boolean;
}) {
  const { place, view, render } = SCENES[scene];
  const frame = FRAMES[scene];
  return (
    <svg
      viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
      role="img"
      aria-label={sceneCaption(scene, state)}
      className={`block h-auto w-full ${className}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs uid={uid} />
      <rect width="1200" height="800" fill={scene === "appartement" ? C.paper : `url(#${uid}-sky)`} />
      {scene !== "appartement" && <Ground />}
      {render({ uid, state })}
      {titleBlock && <TitleBlock place={place} view={view} state={state} frame={frame} />}
    </svg>
  );
}
