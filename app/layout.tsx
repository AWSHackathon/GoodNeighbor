import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Good Neighbor",
  description: "Neighborhood assistance map — AWS Hackathon 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
