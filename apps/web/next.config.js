/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Restrict CORS to explicit origins — wildcard is unsafe on mutation endpoints.
    // Mobile app authenticates via Bearer token so CORS origin restriction is fine.
    const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "https://truthstay.com";

    return [
      {
        // Allow mobile app to call API routes
        source: "/api/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type,Authorization" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              // Allow Komoot embeds + Mapbox tiles
              "frame-src https://www.komoot.com https://komoot.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.mapbox.com https://events.mapbox.com",
              "font-src 'self' data:",
              "worker-src blob:",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
