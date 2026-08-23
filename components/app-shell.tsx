"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  ClipboardCheck,
  LibraryBig,
  UserRound,
} from "lucide-react";

import { t, type TranslationKey } from "@/lib/i18n";
import {
  commitRouteHistory,
  consumeRouteDirection,
  markPopstateRouteDirection,
} from "@/lib/navigation-memory";
import { LiquidNav, type LiquidNavItem } from "@/components/liquid-nav";
import { BrandLockup } from "@/components/ui/brand";
import { cn } from "@/lib/cn";
import { SyncIndicator } from "@/components/sync-indicator";
import { useUIStore } from "@/stores/ui-store";

const destinations = [
  { href: "/", label: "nav.study", icon: Brain },
  { href: "/library", label: "nav.library", icon: LibraryBig },
  {
    href: "/practice",
    activePathPrefix: "/practice",
    label: "nav.practice",
    icon: ClipboardCheck,
  },
] satisfies {
  href: string;
  activePathPrefix?: string;
  label: TranslationKey;
  icon: typeof ClipboardCheck;
}[];

function isSecondaryMobileRoute(pathname: string) {
  if (pathname.startsWith("/sets/") || pathname === "/sets/new") return true;
  if (/^\/questions\/.+/.test(pathname)) return true;
  return false;
}

function RouteTransition({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const [direction] = React.useState(() => consumeRouteDirection(pathname));
  return (
    <div className="route-page t-route-enter" data-route-direction={direction}>
      {children}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const practiceActive = useUIStore((store) => store.practiceActive);
  const showMobileNavigation = !practiceActive && !isSecondaryMobileRoute(pathname);

  React.useEffect(() => commitRouteHistory(pathname), [pathname]);

  React.useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 8);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

  React.useEffect(() => {
    const markHistoryTraversal = (event: PopStateEvent) =>
      markPopstateRouteDirection(event.state, window.location.pathname);
    window.addEventListener("popstate", markHistoryTraversal);
    return () => window.removeEventListener("popstate", markHistoryTraversal);
  }, []);

  const navItems = React.useMemo<LiquidNavItem[]>(
    () =>
      destinations.map((d) => ({
        href: d.href,
        activePathPrefix: d.activePathPrefix,
        icon: <d.icon className="size-[1.125rem]" />,
        label: t(d.label),
      })),
    [],
  );

  return (
    <div
      className={cn(
        "app-shell min-h-[100dvh] bg-[var(--surface-stage)]",
        !practiceActive && "md:grid md:grid-cols-[15rem_minmax(0,1fr)]",
      )}
      data-focus={practiceActive}
    >
      {!practiceActive && <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background/92 p-3 backdrop-blur-xl md:flex">
        <div className="flex items-center justify-between px-2 pb-5 pt-2">
          <BrandLockup href="/" />
          <SyncIndicator />
        </div>
        <LiquidNav
          className="flex-1 content-start"
          items={navItems}
          pathname={pathname}
          vertical
        />
        <Link
          href="/me"
          aria-current={pathname === "/me" ? "page" : undefined}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-[0.625rem] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
            pathname === "/me" &&
              "bg-secondary text-foreground shadow-[var(--shadow-control)]",
          )}
        >
          <UserRound className="size-[1.125rem]" />
          {t("nav.me")}
        </Link>
      </aside>}

      <div className={cn("min-w-0", !practiceActive && "md:col-start-2")}>
        <div aria-hidden className="app-top-blur" data-visible={scrolled} />
        <main
          className={`app-viewport pt-[max(1rem,var(--safe-top))] md:pb-12 md:pt-6 ${
            showMobileNavigation
              ? "pb-[calc(6.5rem+min(0.625rem,var(--safe-bottom)))]"
              : "pb-[max(2rem,var(--safe-bottom))]"
          }`}
        >
          {showMobileNavigation && (
            <div className="app-mobile-header mb-4 flex h-10 items-center justify-between md:hidden">
              <BrandLockup
                href="/"
                markClassName="size-9 rounded-lg p-2"
                className="gap-2"
              />
              <div className="flex items-center gap-1">
                <Link
                  href="/me"
                  aria-label={t("nav.me")}
                  aria-current={pathname === "/me" ? "page" : undefined}
                  className={cn(
                    "grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                    pathname === "/me" && "bg-secondary text-foreground",
                  )}
                >
                  <UserRound className="size-[1.125rem]" />
                </Link>
                <SyncIndicator />
              </div>
            </div>
          )}
          <RouteTransition key={pathname} pathname={pathname}>
            {children}
          </RouteTransition>
        </main>

        <div
          aria-hidden={!showMobileNavigation}
          className="app-mobile-nav fixed z-30 mx-auto max-w-md rounded-full border bg-background/92 px-3 py-1.5 shadow-[var(--shadow-floating)] backdrop-blur-xl md:hidden"
          data-visible={showMobileNavigation}
          inert={!showMobileNavigation}
        >
          <LiquidNav
            className="mx-auto h-12"
            items={navItems}
            pathname={pathname}
          />
        </div>
      </div>
    </div>
  );
}
