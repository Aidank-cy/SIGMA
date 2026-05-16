import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGMA",
  description: "Stock Intelligence Gathering & Multi-source Analyzer"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
