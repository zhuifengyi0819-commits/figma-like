import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Canvas — Personal Design Tool",
  description: "A personal Figma-like canvas tool with AI-powered drawing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="h-full antialiased">
        {children}
        <div className="noise-overlay" />
      </body>
    </html>
  );
}
