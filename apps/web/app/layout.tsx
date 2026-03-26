import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TruthStay — Active Holiday Reviews by Real People",
  description:
    "Discover honest reviews of cycling routes, hiking trails, accommodation, and restaurants from friends who've actually been there.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${archivo.variable} font-[family-name:var(--font-archivo)] bg-white text-[#212121]`}>
        {children}
      </body>
    </html>
  );
}
