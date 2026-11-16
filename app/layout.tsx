import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/navigation/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FieldsConnect",
  description: "Mentorship and professional connection platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppShell
          initialBuildId={
            process.env.VERCEL_GIT_COMMIT_SHA ||
            process.env.VERCEL_DEPLOYMENT_ID ||
            process.env.VERCEL_URL ||
            "local"
          }
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
