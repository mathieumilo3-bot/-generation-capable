import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monteur IA",
  description: "Ton monteur vidéo personnel, propulsé par l'IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
