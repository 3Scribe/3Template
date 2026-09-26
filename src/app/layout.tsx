import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "3T · Dashboard", template: "%s · 3T" },
  description: "Self-hosted template management and localisation.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="app-header">
          <Link className="brand" href="/" aria-label="3T home">
            3T
          </Link>
          <span>Community</span>
          <nav aria-label="Main navigation">
            <Link href="/">Dashboard</Link>
          </nav>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer>3T · Template management and localisation</footer>
      </body>
    </html>
  );
}
