import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CompanyVerse — Onboarding Adventure",
  description:
    "Turn enterprise knowledge into a personalized, playable onboarding game.",
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
