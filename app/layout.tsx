import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildPath | Less paperwork for builders",
  description: "Snap photos and talk through the day. BuildPath writes the daily logs, drafts the change orders and keeps the job record for small builders and remodelers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
