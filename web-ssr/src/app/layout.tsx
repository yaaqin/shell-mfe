import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SSR App — Home",
  description: "Server-side rendered app (tokens in httpOnly cookies)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <span className="badge">SSR</span>
            <strong>web-ssr</strong>
            <span className="muted">tokens stored in httpOnly cookies</span>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
