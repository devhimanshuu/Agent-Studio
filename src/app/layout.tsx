import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent Studio — Enterprise AI Agent Platform",
  description: "Create, test, version, and execute reusable user-defined AI skills safely.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClerkProvider
          appearance={{
            layout: {
              unsafe_disableDevelopmentModeWarnings: true,
            },
            variables: {
              colorPrimary: "#818cf8",
              colorBackground: "#000000",
              colorText: "#e2e8f0",
              colorTextSecondary: "#94a3b8",
              colorInputBackground: "#0a0a0a",
              colorInputText: "#ffffff",
              fontFamily: "JetBrains Mono, monospace",
              borderRadius: "0.25rem",
            },
            elements: {
              card: "border border-indigo-900/50 bg-black font-mono shadow-2xl shadow-indigo-950/80 rounded",
              headerTitle: "font-pixel text-indigo-300 uppercase tracking-wide text-lg",
              headerSubtitle: "font-mono text-slate-400 text-xs",
              socialButtonsBlockButton: "border border-indigo-900/40 bg-indigo-950/40 font-mono text-xs hover:border-indigo-400 text-slate-200 rounded",
              formButtonPrimary: "border border-indigo-400 bg-indigo-600 font-mono text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/30 uppercase tracking-wider rounded py-2.5",
              formFieldInput: "border border-indigo-900/50 bg-[#0a0a0a] font-mono text-xs text-slate-100 focus:border-indigo-400 rounded",
              footer: "hidden", // Removes Clerk branding & logo at bottom of modals
              footerAction: "font-mono text-xs text-indigo-400 hover:text-indigo-300",
              footerActionLink: "font-mono text-xs text-indigo-400 hover:text-indigo-300 underline",
              logoBox: "hidden", // Removes Clerk logo box
              logoImage: "hidden", // Removes Clerk logo image
              userButtonPopoverCard: "border border-indigo-900/50 bg-black font-mono shadow-xl rounded",
              userButtonPopoverActionButton: "font-mono text-xs text-slate-300 hover:bg-indigo-950/50 hover:text-indigo-300",
              userButtonPopoverFooter: "hidden", // Removes Clerk footer in user profile popover
              userButtonAvatarBox: "w-8 h-8 rounded border border-indigo-500/40 shadow-sm",
            },
          }}
        >
          <Providers>
            <div className="min-h-screen flex flex-col bg-background text-foreground">
              <Header />
              <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1 p-6 overflow-y-auto">{children}</main>
              </div>
            </div>
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}
