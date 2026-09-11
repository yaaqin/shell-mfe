import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CSR App — Login",
  description: "Client-side rendered app (tokens in localStorage)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <span className="badge">CSR</span>
            <strong>web-csr</strong>
            <span className="muted">tokens stored in localStorage</span>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
