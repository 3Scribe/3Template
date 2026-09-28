import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "3Template", template: "%s · 3Template" },
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
          <Link className="brand" href="/" aria-label="3Template home">
            3Template
          </Link>
          <span>Community</span>
          <nav aria-label="Main navigation">
            <Link href="/">Dashboard</Link>
            <Link href="/settings/credentials">Settings</Link>
          </nav>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer>3Template · Template management and localisation</footer>
      </body>
    </html>
  );
}
