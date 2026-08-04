"use client";

import React from "react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SidebarProvider } from "@/components/providers/SidebarContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryProvider>
        <SidebarProvider>{children}</SidebarProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}

export default Providers;
