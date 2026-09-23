import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Malayalam } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const ml = Noto_Sans_Malayalam({ variable: "--font-ml", subsets: ["malayalam"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Welfare Navigator",
  description: "Find welfare schemes a fishing or plantation family in Kerala may potentially be eligible for.",
  robots: { index: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ml" className={`${sans.variable} ${ml.variable}`}>
      <body>{children}</body>
    </html>
  );
}
