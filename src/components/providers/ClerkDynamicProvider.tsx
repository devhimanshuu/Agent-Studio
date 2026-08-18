"use client";

import React, { useEffect, useState } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { useTheme } from "next-themes";

function getClerkThemeConfig(theme: string | undefined) {
  if (theme === "light") {
    return {
      variables: {
        colorPrimary: "#4f46e5",
        colorBackground: "#ffffff",
        colorText: "#0f172a",
        colorTextSecondary: "#64748b",
        colorInputBackground: "#f8fafc",
        colorInputText: "#0f172a",
        fontFamily: "JetBrains Mono, monospace",
        borderRadius: "0.25rem",
      },
      elements: {
        modalBackdrop: "bg-white/80 dark:bg-black/80 backdrop-blur-sm",
        card: "border border-slate-200 bg-white font-mono shadow-xl rounded text-slate-900",
        headerTitle: "font-pixel text-indigo-600 uppercase tracking-wide text-lg",
        headerSubtitle: "font-mono text-slate-600 text-xs",
        socialButtonsBlockButton: "border border-slate-300 bg-slate-50 font-mono text-xs hover:border-indigo-400 text-slate-800 rounded",
        formButtonPrimary: "border border-indigo-500 bg-indigo-600 font-mono text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/20 uppercase tracking-wider rounded py-2.5",
        formFieldInput: "border border-slate-300 bg-slate-50 font-mono text-xs text-slate-900 focus:border-indigo-500 rounded",
        formFieldLabel: "font-mono text-xs text-slate-700",
        footer: "hidden",
        footerAction: "font-mono text-xs text-indigo-600 hover:text-indigo-500",
        footerActionLink: "font-mono text-xs text-indigo-600 hover:text-indigo-500 underline",
        logoBox: "hidden",
        logoImage: "hidden",
        userButtonPopoverCard: "border border-slate-200 bg-white font-mono shadow-xl rounded",
        userButtonPopoverActionButton: "font-mono text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600",
        userButtonPopoverActionButtonIcon: "text-indigo-600",
        userButtonPopoverFooter: "hidden",
        userButtonAvatarBox: "w-8 h-8 rounded-full border border-indigo-400/50 shadow-sm",
        profileSection: "border-b border-slate-200 py-4",
        profileSectionTitleText: "font-mono font-semibold text-indigo-700 text-xs tracking-wide",
        profileSectionSubtitleText: "font-mono text-slate-600 text-xs",
        profileSectionContent: "text-slate-800",
        userProfileCard: "bg-white border-0 shadow-none",
        breadcrumbsItem: "text-slate-600 text-xs font-mono",
        badge: "font-mono text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200",
        accordionTriggerButton: "text-slate-800 hover:bg-slate-100",
      },
    };
  }

  // Default Dark (Midnight Indigo)
  return {
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
      modalBackdrop: "bg-black/80 backdrop-blur-sm",
      card: "border border-indigo-900/50 bg-black font-mono shadow-2xl shadow-indigo-950/80 rounded text-slate-100",
      headerTitle: "font-pixel text-indigo-300 uppercase tracking-wide text-lg",
      headerSubtitle: "font-mono text-slate-400 text-xs",
      socialButtonsBlockButton: "border border-indigo-900/40 bg-indigo-950/40 font-mono text-xs hover:border-indigo-400 text-slate-200 rounded",
      formButtonPrimary: "border border-indigo-400 bg-indigo-600 font-mono text-xs font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-500/30 uppercase tracking-wider rounded py-2.5",
      formFieldInput: "border border-indigo-900/50 bg-[#0a0a0a] font-mono text-xs text-slate-100 focus:border-indigo-400 rounded",
      formFieldLabel: "font-mono text-xs text-slate-300",
      footer: "hidden",
      footerAction: "font-mono text-xs text-indigo-400 hover:text-indigo-300",
      footerActionLink: "font-mono text-xs text-indigo-400 hover:text-indigo-300 underline",
      logoBox: "hidden",
      logoImage: "hidden",
      userButtonPopoverCard: "border border-indigo-900/50 bg-black font-mono shadow-xl rounded",
      userButtonPopoverActionButton: "font-mono text-xs text-slate-300 hover:bg-indigo-950/50 hover:text-indigo-300",
      userButtonPopoverActionButtonIcon: "text-indigo-400",
      userButtonPopoverFooter: "hidden",
      userButtonAvatarBox: "w-8 h-8 rounded-full border border-indigo-500/40 shadow-sm",
      profileSection: "border-b border-indigo-900/30 py-4",
      profileSectionTitleText: "font-mono font-semibold text-indigo-300 text-xs tracking-wide",
      profileSectionSubtitleText: "font-mono text-slate-400 text-xs",
      profileSectionContent: "text-slate-200",
      userProfileCard: "bg-black border-0 shadow-none",
      breadcrumbsItem: "text-slate-400 text-xs font-mono",
      badge: "font-mono text-[10px] bg-indigo-950/60 text-indigo-300 border border-indigo-800",
      accordionTriggerButton: "text-slate-200 hover:bg-indigo-950/40",
    },
  };
}

export function ClerkDynamicProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? theme : "dark";
  const themeConfig = getClerkThemeConfig(currentTheme);

  return (
    <ClerkProvider
      appearance={{
        layout: {
          unsafe_disableDevelopmentModeWarnings: true,
        },
        variables: themeConfig.variables,
        elements: themeConfig.elements,
      }}
    >
      {children}
    </ClerkProvider>
  );
}

export default ClerkDynamicProvider;
