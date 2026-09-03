export const metadata = { title: "Minecraft 24/7 Bot Platform", description: "Vercel frontend - bot execution is independent" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", margin: 0, background: "#0a0a0a", color: "#eaeaea" }}>
        <nav style={{ padding: 16, borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between" }}>
          <strong>Minecraft 24/7 Bot Platform</strong>
          <span style={{ opacity: 0.6, fontSize: 12 }}>Frontend: Vercel · API: Cloudflare → Openor · DB: Supabase · Bots: Execution Layer</span>
        </nav>
        {children}
      </body>
    </html>
  );
}
