import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conforme — Compliance elettorale",
  description: "Gestione della compliance elettorale"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
