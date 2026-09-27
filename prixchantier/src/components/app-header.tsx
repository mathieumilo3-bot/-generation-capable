"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Home, Inbox, LogOut, Menu, Settings, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Accueil", icon: Home, match: (p: string) => p === "/" },
  { href: "/fournisseurs", label: "Fournisseurs", icon: Building2, match: (p: string) => p.startsWith("/fournisseurs") },
  { href: "/reponses", label: "Réponses", icon: Inbox, match: (p: string) => p.startsWith("/reponses") },
  { href: "/parametres", label: "Paramètres", icon: Settings, match: (p: string) => p.startsWith("/parametres") },
];

export function AppHeader({ email, organizationName }: { email: string; organizationName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
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
              <button type="button" aria-label="Fermer le menu" className="fixed inset-0 top-14 z-40 cursor-default bg-transparent" onClick={() => setOpen(false)} />
              <div className="absolute right-4 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg sm:right-6">
                <div className="px-3 py-2 text-xs text-muted-foreground break-all">{email}</div>
                <div className="my-1 h-px bg-border" />
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 backdrop-blur sm:hidden" aria-label="Navigation principale">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link key={item.href} href={item.href} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground", active && "text-foreground")}>
                <Icon className={cn("size-5", active && "stroke-[2.4]")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
