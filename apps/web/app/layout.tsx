import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Numera — Professional Accounting Services",
  description: "Expert bookkeeping and tax preparation for Philippine SMBs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
