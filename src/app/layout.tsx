import type { Metadata } from "next";
import { DM_Sans, Archivo } from "next/font/google";
import { MistProvider } from "@/components/MistEffect";
import { OrganicBackground } from "@/components/OrganicBackground";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Scentesia",
  description: "Upload images that represent your vibe and discover the perfumes that match your world.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${archivo.variable} ${dmSans.variable} antialiased bg-black text-white`} suppressHydrationWarning>
        <OrganicBackground />
        <MistProvider>
          {children}
        </MistProvider>
      </body>
    </html>
  );
}
