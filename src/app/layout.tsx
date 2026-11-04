import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "HAV Energia",
  description: "Gestão de usinas, investidores e captação da HAV Energia.",
  robots: { index: false, follow: false },
  icons: { icon: "/icone-64.png", apple: "/icone-apple.png" },
};

export const viewport: Viewport = { themeColor: "#0f2742", width: "device-width", initialScale: 1 };

// Tema escolhido no botão lua/sol fica no cookie; sem cookie, o CSS segue o tema do aparelho.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = (await cookies()).get("hav-tema")?.value;
  return (
    <html lang="pt-BR" data-theme={tema === "dark" || tema === "light" ? tema : undefined}>
      <body>{children}</body>
    </html>
  );
}
