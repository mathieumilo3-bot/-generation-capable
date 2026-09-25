"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/misc";
import { logout } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dossiers", match: (p: string) => p === "/" || p.startsWith("/dossiers") },
  { href: "/fournisseurs", label: "Fournisseurs", match: (p: string) => p.startsWith("/fournisseurs") },
  { href: "/parametres", label: "Paramètres", match: (p: string) => p.startsWith("/parametres") },
];

export function AppHeader({ email, organizationName }: { email: string; organizationName: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Accueil">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu du compte">
                <Menu />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">{email}</div>
              <DropdownMenuSeparator />
              {NAV.map((item) => (
                <DropdownMenuItem key={item.href} asChild className="sm:hidden">
                  <Link href={item.href}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem onSelect={() => void logout()}>
                <LogOut /> Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
