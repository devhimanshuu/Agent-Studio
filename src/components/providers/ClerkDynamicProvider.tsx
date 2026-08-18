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

  if (theme === "cyberpunk") {
    return {
      variables: {
        colorPrimary: "#ff007f",
        colorBackground: "#08000f",
        colorText: "#f1f5f9",
        colorTextSecondary: "#00f0ff",
        colorInputBackground: "#130324",
        colorInputText: "#ffffff",
        fontFamily: "JetBrains Mono, monospace",
        borderRadius: "0.25rem",
      },
      elements: {
        modalBackdrop: "bg-[#08000f]/80 backdrop-blur-sm",
        card: "border border-pink-500/50 bg-[#08000f] font-mono shadow-2xl shadow-pink-950/80 rounded text-slate-100",
        headerTitle: "font-pixel text-pink-500 uppercase tracking-wide text-lg",
        headerSubtitle: "font-mono text-cyan-400 text-xs",
        socialButtonsBlockButton: "border border-pink-500/40 bg-pink-950/40 font-mono text-xs hover:border-cyan-400 text-slate-200 rounded",
        formButtonPrimary: "border border-pink-400 bg-pink-600 font-mono text-xs font-semibold text-white hover:bg-pink-500 shadow-md shadow-pink-500/40 uppercase tracking-wider rounded py-2.5",
        formFieldInput: "border border-pink-900/60 bg-[#130324] font-mono text-xs text-slate-100 focus:border-cyan-400 rounded",
        formFieldLabel: "font-mono text-xs text-pink-300",
        footer: "hidden",
        footerAction: "font-mono text-xs text-pink-400 hover:text-pink-300",
        footerActionLink: "font-mono text-xs text-cyan-400 hover:text-cyan-300 underline",
        logoBox: "hidden",
        logoImage: "hidden",
        userButtonPopoverCard: "border border-pink-500/50 bg-[#08000f] font-mono shadow-xl rounded",
        userButtonPopoverActionButton: "font-mono text-xs text-slate-300 hover:bg-pink-950/50 hover:text-cyan-300",
        userButtonPopoverActionButtonIcon: "text-pink-400",
        userButtonPopoverFooter: "hidden",
        userButtonAvatarBox: "w-8 h-8 rounded-full border border-pink-500/50 shadow-sm",
        profileSection: "border-b border-pink-900/40 py-4",
        profileSectionTitleText: "font-mono font-semibold text-pink-400 text-xs tracking-wide",
        profileSectionSubtitleText: "font-mono text-cyan-300 text-xs",
        profileSectionContent: "text-slate-200",
        userProfileCard: "bg-[#08000f] border-0 shadow-none",
        breadcrumbsItem: "text-pink-400 text-xs font-mono",
        badge: "font-mono text-[10px] bg-pink-950/60 text-cyan-300 border border-pink-800",
        accordionTriggerButton: "text-slate-200 hover:bg-pink-950/40",
      },
    };
  }

  if (theme === "matrix") {
    return {
      variables: {
        colorPrimary: "#00ff66",
        colorBackground: "#020803",
        colorText: "#86efac",
        colorTextSecondary: "#34d399",
        colorInputBackground: "#041708",
        colorInputText: "#86efac",
        fontFamily: "JetBrains Mono, monospace",
        borderRadius: "0.25rem",
      },
      elements: {
        modalBackdrop: "bg-[#020803]/80 backdrop-blur-sm",
        card: "border border-emerald-800/60 bg-[#020803] font-mono shadow-2xl shadow-emerald-950/80 rounded text-emerald-300",
        headerTitle: "font-pixel text-emerald-400 uppercase tracking-wide text-lg",
        headerSubtitle: "font-mono text-emerald-600 text-xs",
        socialButtonsBlockButton: "border border-emerald-800/40 bg-emerald-950/40 font-mono text-xs hover:border-emerald-400 text-emerald-300 rounded",
        formButtonPrimary: "border border-emerald-400 bg-emerald-700 font-mono text-xs font-semibold text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30 uppercase tracking-wider rounded py-2.5",
        formFieldInput: "border border-emerald-900/60 bg-[#041708] font-mono text-xs text-emerald-300 focus:border-emerald-400 rounded",
        formFieldLabel: "font-mono text-xs text-emerald-400",
        footer: "hidden",
        footerAction: "font-mono text-xs text-emerald-400 hover:text-emerald-300",
        footerActionLink: "font-mono text-xs text-emerald-400 hover:text-emerald-300 underline",
        logoBox: "hidden",
        logoImage: "hidden",
        userButtonPopoverCard: "border border-emerald-800/60 bg-[#020803] font-mono shadow-xl rounded",
        userButtonPopoverActionButton: "font-mono text-xs text-emerald-300 hover:bg-emerald-950/50 hover:text-emerald-200",
        userButtonPopoverActionButtonIcon: "text-emerald-400",
        userButtonPopoverFooter: "hidden",
        userButtonAvatarBox: "w-8 h-8 rounded-full border border-emerald-500/40 shadow-sm",
        profileSection: "border-b border-emerald-900/40 py-4",
        profileSectionTitleText: "font-mono font-semibold text-emerald-400 text-xs tracking-wide",
        profileSectionSubtitleText: "font-mono text-emerald-600 text-xs",
        profileSectionContent: "text-emerald-300",
        userProfileCard: "bg-[#020803] border-0 shadow-none",
        breadcrumbsItem: "text-emerald-500 text-xs font-mono",
        badge: "font-mono text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-800",
        accordionTriggerButton: "text-emerald-300 hover:bg-emerald-950/40",
      },
    };
  }

  if (theme === "synthwave") {
    return {
      variables: {
        colorPrimary: "#c084fc",
        colorBackground: "#0f051d",
        colorText: "#f3e8ff",
        colorTextSecondary: "#f97316",
        colorInputBackground: "#1c0b36",
        colorInputText: "#ffffff",
        fontFamily: "JetBrains Mono, monospace",
        borderRadius: "0.25rem",
      },
      elements: {
        modalBackdrop: "bg-[#0f051d]/80 backdrop-blur-sm",
        card: "border border-purple-800/60 bg-[#0f051d] font-mono shadow-2xl shadow-purple-950/80 rounded text-slate-100",
        headerTitle: "font-pixel text-purple-400 uppercase tracking-wide text-lg",
        headerSubtitle: "font-mono text-orange-400 text-xs",
        socialButtonsBlockButton: "border border-purple-800/40 bg-purple-950/40 font-mono text-xs hover:border-orange-400 text-purple-200 rounded",
        formButtonPrimary: "border border-purple-400 bg-purple-600 font-mono text-xs font-semibold text-white hover:bg-purple-500 shadow-md shadow-purple-500/40 uppercase tracking-wider rounded py-2.5",
        formFieldInput: "border border-purple-900/60 bg-[#1c0b36] font-mono text-xs text-slate-100 focus:border-orange-400 rounded",
        formFieldLabel: "font-mono text-xs text-purple-300",
        footer: "hidden",
        footerAction: "font-mono text-xs text-purple-400 hover:text-purple-300",
        footerActionLink: "font-mono text-xs text-orange-400 hover:text-orange-300 underline",
        logoBox: "hidden",
        logoImage: "hidden",
        userButtonPopoverCard: "border border-purple-800/60 bg-[#0f051d] font-mono shadow-xl rounded",
        userButtonPopoverActionButton: "font-mono text-xs text-slate-300 hover:bg-purple-950/50 hover:text-orange-300",
        userButtonPopoverActionButtonIcon: "text-purple-400",
        userButtonPopoverFooter: "hidden",
        userButtonAvatarBox: "w-8 h-8 rounded-full border border-purple-500/40 shadow-sm",
        profileSection: "border-b border-purple-900/40 py-4",
        profileSectionTitleText: "font-mono font-semibold text-purple-400 text-xs tracking-wide",
        profileSectionSubtitleText: "font-mono text-orange-300 text-xs",
        profileSectionContent: "text-slate-200",
        userProfileCard: "bg-[#0f051d] border-0 shadow-none",
        breadcrumbsItem: "text-purple-400 text-xs font-mono",
        badge: "font-mono text-[10px] bg-purple-950/60 text-purple-300 border border-purple-800",
        accordionTriggerButton: "text-slate-200 hover:bg-purple-950/40",
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
