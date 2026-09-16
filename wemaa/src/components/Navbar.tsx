import { useEffect, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { brand, nav } from "../data/content";
import { useScrolled } from "../hooks/useScrolled";
import { GoldButton } from "./Button";

export function Navbar() {
  const scrolled = useScrolled(30);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Ferme le menu mobile à chaque changement de page.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Verrouille le scroll de fond quand le menu mobile est ouvert.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleNavClick = (event: MouseEvent, href: string) => {
    const hash = href.replace("/", "");
    if (location.pathname === "/") {
      event.preventDefault();
      const el = document.querySelector(hash);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      event.preventDefault();
      navigate(href);
    }
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-or/10 bg-noir/90 backdrop-blur-md py-3"
          : "border-b border-transparent bg-gradient-to-b from-noir/60 to-transparent py-5"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link to="/" className="font-serif text-xl tracking-[0.15em] text-ivoire">
          WEMAA <span className="text-or">SERVICES</span>
        </Link>

        <nav className="hidden items-center gap-9 lg:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="text-sm tracking-wide text-ivoire/80 transition-colors duration-300 hover:text-or"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <GoldButton href="/devis" className="!px-6 !py-2.5 !text-xs">
            Demander un devis
          </GoldButton>
        </div>

        <button
          type="button"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="relative z-50 flex h-10 w-10 flex-col items-center justify-center gap-1.5 lg:hidden"
        >
          <span
            className={`block h-px w-6 bg-ivoire transition-all duration-300 ${
              open ? "translate-y-[3.5px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-px w-6 bg-ivoire transition-all duration-300 ${
              open ? "-translate-y-[3.5px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Menu mobile */}
      <div
        className={`fixed inset-0 z-40 flex flex-col bg-noir transition-opacity duration-300 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
          {nav.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              style={{ transitionDelay: open ? `${i * 60}ms` : "0ms" }}
              className={`font-serif text-3xl text-ivoire transition-all duration-500 hover:text-or ${
                open ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              }`}
            >
              {item.label}
            </a>
          ))}
          <GoldButton href="/devis" className="mt-4">
            Demander un devis
          </GoldButton>
        </div>
        <p className="pb-8 text-center text-xs tracking-[0.2em] text-ivoire/40">
          {brand.tagline.toUpperCase()}
        </p>
      </div>
    </header>
  );
}
