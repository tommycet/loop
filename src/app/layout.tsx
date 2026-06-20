import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  axes: ["opsz"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Loop — Commitment Control Plane",
    template: "%s · Loop",
  },
  description:
    "Every promise made in chat, ranked and assigned. Loop is the commitment control plane for chat-run businesses.",
  metadataBase: new URL("https://45bdea48111811.lhr.life"),
  openGraph: {
    title: "Loop — Commitment Control Plane",
    description:
      "Every promise made in chat — ranked, assigned, approved, audited. Nothing ships without authority.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#0b0f17",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}