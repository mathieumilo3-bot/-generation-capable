import { Link } from "react-router-dom";
import { brand, contact, footer } from "../data/content";

export function Footer() {
  return (
    <footer className="border-t border-or/10 bg-noir">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10">
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Link to="/" className="font-serif text-xl tracking-[0.15em] text-ivoire">
              WEMAA <span className="text-or">SERVICES</span>
            </Link>
            <p className="mt-4 text-xs tracking-[0.15em] text-ivoire/50">
              {brand.tagline.toUpperCase()}
            </p>

            <div className="mt-6 flex gap-4">
              {contact.socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-ivoire/15 text-xs text-ivoire/60 transition-colors duration-300 hover:border-or hover:text-or"
                  aria-label={s.label}
                >
                  {s.label.charAt(0)}
                </a>
              ))}
            </div>
          </div>

          {footer.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-medium tracking-[0.2em] text-ivoire">{col.title.toUpperCase()}</h3>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/#") ? (
                      <a href={link.href} className="text-sm text-ivoire/60 transition-colors hover:text-or">
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.href} className="text-sm text-ivoire/60 transition-colors hover:text-or">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="text-xs font-medium tracking-[0.2em] text-ivoire">COORDONNÉES</h3>
            <ul className="mt-5 space-y-3 text-sm text-ivoire/60">
              <li>{contact.phone}</li>
              <li>{contact.email}</li>
              <li>{contact.location}</li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col-reverse items-center justify-between gap-4 border-t border-ivoire/10 pt-8 sm:flex-row">
          <p className="text-xs text-ivoire/40">
            © {new Date().getFullYear()} {brand.name}. Tous droits réservés.
          </p>
          <div className="flex gap-6">
            {footer.legal.map((l) => (
              <a key={l.label} href={l.href} className="text-xs text-ivoire/40 transition-colors hover:text-or">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
