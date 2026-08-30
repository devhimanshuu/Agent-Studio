"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

const ALL_THEMES = ["light", "dark"];

function ThemeClassSync() {
  const { theme, resolvedTheme } = useTheme();

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const currentTheme = theme || resolvedTheme || "dark";

    // Strip existing theme classes
    ALL_THEMES.forEach((t) => root.classList.remove(t));

    if (currentTheme === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
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
