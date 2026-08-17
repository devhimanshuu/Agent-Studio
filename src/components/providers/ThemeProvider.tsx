"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

function ThemeClassSync() {
  const { theme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const syncDark = () => {
      const activeTheme = root.getAttribute("class") || theme || resolvedTheme || "dark";
      if (activeTheme.includes("light") && !activeTheme.includes("dark") && !activeTheme.includes("cyberpunk") && !activeTheme.includes("matrix") && !activeTheme.includes("synthwave")) {
        root.classList.remove("dark");
      } else {
        if (!root.classList.contains("dark")) {
          root.classList.add("dark");
        }
      }
    };

    syncDark();

    // Observe changes to html class made by next-themes
    const observer = new MutationObserver(() => {
      syncDark();
    });

    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, [theme, resolvedTheme]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeClassSync />
      {children}
    </NextThemesProvider>
  );
}

export default ThemeProvider;
