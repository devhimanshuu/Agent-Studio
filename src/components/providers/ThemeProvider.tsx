"use client";

import * as React from "react";
import * as NextThemes from "next-themes";

const NextThemesProvider =
  NextThemes.ThemeProvider ||
  (NextThemes as any).default?.ThemeProvider ||
  (NextThemes as any).default;

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemes.ThemeProvider>) {
  if (!NextThemesProvider) {
    return <>{children}</>;
  }
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export default ThemeProvider;
