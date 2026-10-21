import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fluent Mirror — Find your flow",
  description: "Speak freely. See your words reflected more naturally. A calm space for live language practice.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
