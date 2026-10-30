import type { NextConfig } from "next";

function hostPublico(): string[] {
  try {
    return process.env.APP_URL ? [new URL(process.env.APP_URL).host] : [];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  poweredByHeader: false,
  // allowedOrigins: o acesso chega pelo roteador de *.sistemainterno.app
  // (outro projeto do Railway), que repassa com o host do Railway. Libera
  // as server actions vindas do endereço público (APP_URL).
  experimental: {
    serverActions: { bodySizeLimit: "2mb", allowedOrigins: hostPublico() },
  },
  // Cabeçalhos de segurança em todas as páginas. A CSP com nonce sai do proxy.ts.
  async headers() {
    return [
      // Service worker dos avisos: sempre a versão mais nova.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
