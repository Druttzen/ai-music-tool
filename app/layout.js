import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { APP_VERSION } from "./lib/music-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: `AI Music Creator v${APP_VERSION}`,
  description:
    "Visual prompt engine for AI music tools — presets, analyzers, Suno-like prompts, and export.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
