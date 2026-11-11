'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

export interface HeaderAction {
  label: string;
  onClick: () => void;
}

interface AppShellContextType {
  isMobileMenuOpen: boolean;
  openMobileMenu: () => void;
  closeMobileMenu: () => void;
  headerAction: HeaderAction | null;
  setHeaderAction: (action: HeaderAction | null) => void;
}

const AppShellContext = createContext<AppShellContextType>({
  isMobileMenuOpen: false,
  openMobileMenu: () => {},
  closeMobileMenu: () => {},
  headerAction: null,
  setHeaderAction: () => {},
});

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [headerAction, setHeaderAction] = useState<HeaderAction | null>(null);
  const pathname = usePathname();

  // Close mobile drawer automatically upon any navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const openMobileMenu = () => setIsMobileMenuOpen(true);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <AppShellContext.Provider
      value={{
        isMobileMenuOpen,
        openMobileMenu,
        closeMobileMenu,
        headerAction,
        setHeaderAction,
      }}
    >
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell() {
  return useContext(AppShellContext);
}
