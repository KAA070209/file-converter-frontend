import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Konversi — File Converter",
  description: "Konversi gambar ke PDF dan format gambar lain dengan cepat.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
