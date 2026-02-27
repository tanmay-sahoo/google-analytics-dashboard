import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const space = Space_Grotesk({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Marketing Data Hub",
  description: "Multi-tenant analytics workspace for GA4 and Google Ads."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={space.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
