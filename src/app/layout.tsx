import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Inter as FontSans } from "next/font/google";
import { cn } from "../lib/utils";
import { Toaster } from "../components/ui/toaster";
import "@radix-ui/themes/styles.css";
import { Theme, ThemePanel } from "@radix-ui/themes";

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
        <Theme
          accentColor="crimson"
          grayColor="sand"
          radius="large"
          scaling="90%"
        >
          <Toaster />
          {children}
          <ThemePanel />
        </Theme>
      </body>
    </html>
  );
}
