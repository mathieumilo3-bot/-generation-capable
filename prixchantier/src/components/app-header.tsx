"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dossiers", match: (p: string) => p === "/" || p.startsWith("/dossiers") },
  { href: "/fournisseurs", label: "Fournisseurs", match: (p: string) => p.startsWith("/fournisseurs") },
  { href: "/parametres", label: "Paramètres", match: (p: string) => p.startsWith("/parametres") },
];

export function AppHeader({ email, organizationName }: { email: string; organizationName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Accueil" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                item.match(pathname) && "bg-secondary font-medium text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground md:inline">{organizationName}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={open ? "Fermer le menu du compte" : "Ouvrir le menu du compte"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>

        {open ? (
          <>
            <button
              type="button"
              aria-label="Fermer le menu"
              className="fixed inset-0 top-14 z-40 cursor-default bg-transparent"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-4 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg sm:right-6">
              <div className="px-3 py-2 text-xs text-muted-foreground break-all">{email}</div>
              <div className="my-1 h-px bg-border" />

              <div className="grid gap-1 sm:hidden">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent",
                      item.match(pathname) && "bg-secondary",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="my-1 h-px bg-border" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
              >
                <LogOut className="size-4" />
                Se déconnecter
              </button>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
