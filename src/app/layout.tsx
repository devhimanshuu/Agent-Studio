import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Silkscreen, Lora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/feedback/Toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const silkscreen = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-pixel", display: "swap" });
const lora = Lora({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Agent Studio — Enterprise AI Agent Platform",
  description: "Create, test, version, and execute reusable user-defined AI skills safely.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${inter.variable} ${jetbrainsMono.variable} ${silkscreen.variable} ${lora.variable}`}>
        <a href="#main-content" className="skip-to-content-link">
          Skip to main content
        </a>
        <Providers>
          <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
            <Header />
            <div className="flex flex-1 min-h-0 overflow-hidden w-full">
              <Sidebar />
              <main id="main-content" className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto min-h-0 w-full transition-all duration-300">
                {children}
              </main>
            </div>
            <Toaster />
          </div>
        </Providers>
      </body>
    </html>
  );
}
