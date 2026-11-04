import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// Fontes do padrão Logos (as mesmas da Lavateria): Manrope no texto, Sora nos títulos e números.
// O next/font baixa no build e serve do próprio site (cabe no font-src 'self').
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: "HAV Energia",
  description: "Gestão de usinas, investidores e captação da HAV Energia.",
  robots: { index: false, follow: false },
  icons: { icon: "/icone-64.png", apple: "/icone-apple.png" },
};

export const viewport: Viewport = { themeColor: "#0f2742", width: "device-width", initialScale: 1 };

// Tema escolhido no botão lua/sol fica no cookie; sem cookie, abre no claro (não segue o aparelho).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = (await cookies()).get("hav-tema")?.value;
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${sora.variable}`} data-theme={tema === "dark" || tema === "light" ? tema : undefined}>
      <body>{children}</body>
    </html>
  );
}
