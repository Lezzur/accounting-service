import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SkipToContent } from "@numera/ui";
import { NavBar } from "./components/nav-bar";
import { Footer } from "./components/footer";
import { BookingModal } from "./components/booking-modal";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Numera — Expert Bookkeeping and Tax Compliance for Philippine Businesses",
  description:
    "AI-powered accuracy. One accountant. The throughput of five. Expert bookkeeping and BIR tax compliance for Philippine SMBs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <SkipToContent />
        <NavBar />
        <div className="flex-1">{children}</div>
        <Footer />
        <BookingModal />
      </body>
    </html>
  );
}
