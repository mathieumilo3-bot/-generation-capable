import { useEffect, useRef, useState, type FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth, useStaff } from "../state/auth";
import { Badge, Button } from "./ui";

const NAV: ReadonlyArray<{ group: string; items: ReadonlyArray<{ to: string; label: string; end?: boolean }> }> = [
  { group: "Pilotage", items: [{ to: "/", label: "Tableau de bord", end: true }] },
  {
    group: "Clients",
    items: [
      { to: "/clients", label: "Clients" },
      { to: "/ventes", label: "Nouveau client · Ventes" },
    ],
  },
  {
    group: "Production",
    items: [
      { to: "/jobs", label: "Jobs vidéo" },
      { to: "/support", label: "Support" },
    ],
  },
  {
    group: "Finance & système",
    items: [
      { to: "/paiements", label: "Paiements · Webhooks" },
      { to: "/tarifs", label: "Tarifs · Réglages" },
      { to: "/audit", label: "Journal d'audit" },
    ],
  },
];

export function Layout() {
  const { email, role } = useStaff();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/clients?q=${encodeURIComponent(term)}` : "/clients");
  };

  return (
    <div className="app">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo" aria-hidden="true" />
          <span>Back-office</span>
        </div>
        <nav aria-label="Navigation principale" className="nav">
          {NAV.map((g) => (
            <div key={g.group} className="nav__group">
              <div className="nav__title">{g.group}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end ?? false} className={({ isActive }) => `nav__link${isActive ? " nav__link--active" : ""}`}>
                  {it.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__foot">
          <div className="sidebar__user" title={email}>{email}</div>
          <Badge tone={role === "admin" ? "success" : "neutral"}>{role === "admin" ? "Administrateur" : "Support (lecture seule)"}</Badge>
          <Button
            small
            variant="ghost"
            busy={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try { await signOut(); } finally { setSigningOut(false); }
            }}
          >
            Se déconnecter
          </Button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <form role="search" className="search" onSubmit={onSearch}>
            <label htmlFor="global-search" className="sr-only">Rechercher un client</label>
            <input
              id="global-search"
              ref={searchRef}
              type="search"
              placeholder="Rechercher un client (nom, e-mail, entreprise) — touche /"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            <Button type="submit" small>Rechercher</Button>
          </form>
        </div>
        <main id="contenu" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
