import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAV Energia",
  description: "Gestão de usinas, investidores e captação da HAV Energia.",
  robots: { index: false, follow: false },
  icons: { icon: "/icone-64.png", apple: "/icone-apple.png" },
};

export const viewport: Viewport = { themeColor: "#0f2742", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
