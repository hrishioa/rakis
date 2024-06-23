import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Inter as FontSans } from "next/font/google";
import { cn } from "../lib/utils";
import { Toaster } from "../components/ui/toaster";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rakis",
  description: "Decentralized inference in the browser",
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning={true}
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <Theme
          accentColor="violet"
          grayColor="slate"
          radius="medium"
          scaling="100%"
          // appearance="dark"
        >
          <Toaster />
          {children}
          {/* <ThemePanel /> */}
        </Theme>
        <Analytics />
      </body>
    </html>
  );
}
