"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppShellDataProvider } from "@/components/layout/app-shell-data-provider";
import { DesktopTopNav } from "@/components/layout/desktop-top-nav";
import { DemoWorkspaceBanner } from "@/components/layout/demo-workspace-banner";
import { ClubBrandMark } from "@/components/layout/club-brand-mark";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SaasSubscriptionBanner } from "@/components/layout/saas-subscription-banner";
import {
  DISPLAY_MODE_STORAGE_KEY,
  isDisplayMode,
  type DisplayMode,
} from "@/lib/display-mode";

type SidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
};

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggleCollapsed: () => {},
  displayMode: "wide",
  setDisplayMode: () => {},
});

export function useSidebarLayout() {
  return useContext(SidebarContext);
}

const LAYOUT_PREFERENCE_EVENT = "app-layout-preference-change";

function subscribeLayoutPreferences(callback: () => void) {
  function handlePreferenceChange() {
    document.documentElement.dataset.displayMode = getDisplayModeSnapshot();
    callback();
  }

  window.addEventListener("storage", handlePreferenceChange);
  window.addEventListener(LAYOUT_PREFERENCE_EVENT, handlePreferenceChange);
  return () => {
    window.removeEventListener("storage", handlePreferenceChange);
    window.removeEventListener(LAYOUT_PREFERENCE_EVENT, handlePreferenceChange);
  };
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem("sidebar-collapsed") === "1";
}

function getDisplayModeSnapshot(): DisplayMode {
  const stored = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
  return isDisplayMode(stored) ? stored : "wide";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeLayoutPreferences, getCollapsedSnapshot, () => false);
  const displayMode = useSyncExternalStore(
    subscribeLayoutPreferences,
    getDisplayModeSnapshot,
    (): DisplayMode => "wide",
  );

  function toggleCollapsed() {
    window.localStorage.setItem("sidebar-collapsed", collapsed ? "0" : "1");
    window.dispatchEvent(new Event(LAYOUT_PREFERENCE_EVENT));
  }

  function setDisplayMode(mode: DisplayMode) {
    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
    document.documentElement.dataset.displayMode = mode;
    window.dispatchEvent(new Event(LAYOUT_PREFERENCE_EVENT));
  }

  const isAuthRoute =
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/signup" ||
    pathname.startsWith("/signup/") ||
    pathname === "/find-workspace" ||
    pathname === "/auth/activate" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";
  const isMarketingRoute =
    pathname === "/accueil" ||
    pathname.startsWith("/accueil/") ||
    pathname === "/homepage" ||
    pathname.startsWith("/homepage/") ||
    pathname === "/demo";
  const isPublicReceiptRoute = pathname === "/receipts/verify";
  const isReceiptRoute = pathname.startsWith("/receipts/") && !isPublicReceiptRoute;
  const isSubscriptionStatusRoute = pathname === "/subscription-status" || pathname.startsWith("/subscription-status/");
  const isOnboardingRoute = pathname === "/onboarding" || pathname.startsWith("/onboarding/");

  if (isAuthRoute || isMarketingRoute || isPublicReceiptRoute) {
    return <div className="relative min-h-screen">{children}</div>;
  }

  if (isOnboardingRoute) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5"><ClubBrandMark size="md" /></div>
            <LogoutButton className="w-auto border border-[var(--border)] bg-[var(--surface-soft)] px-3" />
          </div>
        </header>
        <main id="main-content">{children}</main>
      </div>
    );
  }

  if (isSubscriptionStatusRoute) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="flex min-h-14 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5"><ClubBrandMark size="md" /></div>
          <LogoutButton className="w-auto border border-[var(--border)] bg-[var(--surface-soft)] px-3" />
        </header>
        <main id="main-content">{children}</main>
      </div>
    );
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, displayMode, setDisplayMode }}>
      <AppShellDataProvider>
        <a href="#main-content" className="skip-link print:hidden">
          Aller au contenu
        </a>
        <MobileNav />
        <div
          data-app-shell-layout={isReceiptRoute ? "receipt" : undefined}
          className={`grid min-h-screen ${collapsed ? "lg:grid-cols-[72px_1fr]" : "lg:grid-cols-[232px_1fr]"} ${isReceiptRoute ? "print:block print:min-h-0" : ""}`}
        >
          <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
          <div
            data-app-shell-content={isReceiptRoute ? "receipt" : undefined}
            className={`flex min-w-0 flex-col bg-[var(--background)] ${isReceiptRoute ? "print:block print:bg-white" : ""}`}
          >
            <DesktopTopNav />
            <DemoWorkspaceBanner />
            <SaasSubscriptionBanner />
            <div id="main-content" tabIndex={-1} className={isReceiptRoute ? "print:block" : undefined}>
              {children}
            </div>
          </div>
        </div>
      </AppShellDataProvider>
    </SidebarContext.Provider>
  );
}
