import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wavelink - P2P Video Calls",
  description: "A minimal WebRTC video/audio calling demo built with Next.js and Socket.IO",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
