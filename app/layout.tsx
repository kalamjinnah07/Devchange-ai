import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DevChange AI",
    template: "%s | DevChange AI",
  },
  description:
    "AI-powered development impact analysis. Turn a vague change request into a structured implementation plan in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-gray-900">
              DevChange AI
            </span>
            <span className="text-sm text-gray-400 font-normal">
              Impact Analysis Assistant
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="border-t border-gray-200 mt-16">
          <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-gray-400">
            Built for the IBM Bob 2.0 Hackathon
          </div>
        </footer>
      </body>
    </html>
  );
}
