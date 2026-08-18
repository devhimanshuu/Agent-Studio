"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "agent-studio-sidebar-collapsed";

interface SidebarContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  mobileOpen: false,
  setMobileOpen: () => {},
  toggleMobileOpen: () => {},
  closeMobile: () => {},
  collapsed: false,
  setCollapsed: () => {},
  toggleCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "1") {
      setCollapsed(true);
    }
  }, []);

  const toggleMobileOpen = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const handleSetCollapsed = (val: boolean) => {
    setCollapsed(val);
    localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
  };

  return (
    <SidebarContext.Provider
      value={{
        mobileOpen,
        setMobileOpen,
        toggleMobileOpen,
        closeMobile,
        collapsed,
        setCollapsed: handleSetCollapsed,
        toggleCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
