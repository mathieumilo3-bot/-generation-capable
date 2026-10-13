import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "GC AI OS",
  description: "Dashboard de l'orchestrateur et des agents de Génération Capable",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
