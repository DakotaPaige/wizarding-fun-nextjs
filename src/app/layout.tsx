import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import { SITE } from "@/content/site";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE.title,
  description: `${SITE.tagline}: spells, the four houses and their people, and a Sorting Hat quiz. A Harry Potter fan project.`,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
