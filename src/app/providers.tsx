"use client";

import React from "react";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ClerkDynamicProvider } from "@/components/providers/ClerkDynamicProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SidebarProvider } from "@/components/providers/SidebarContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      themes={["dark", "light"]}
      enableSystem={false}
    >
      <ClerkDynamicProvider>
        <QueryProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </QueryProvider>
      </ClerkDynamicProvider>
    </ThemeProvider>
  );
}

export default Providers;
