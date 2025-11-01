import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { initDatabase } from "@/lib/db";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Loan Tracker",
  description: "Track loans with interest calculations",
};

// Initialize database on app start
initDatabase().catch(console.error);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
