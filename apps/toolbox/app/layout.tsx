import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Numera Toolbox",
  description: "Internal CRM and Workdesk for Numera accounting operations.",
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
