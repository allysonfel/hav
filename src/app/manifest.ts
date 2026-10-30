import type { MetadataRoute } from "next";

// App instalável (tela de início do celular).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HAV Energia",
    short_name: "HAV Energia",
    description: "Acompanhe suas usinas, sua receita e seus relatórios.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f2742",
    theme_color: "#0f2742",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
