import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildPath | Project Intelligence",
  description: "A connected memory and intelligence layer for construction projects.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
