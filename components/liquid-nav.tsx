"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { markRouteDirection } from "@/lib/navigation-memory";

export interface LiquidNavItem {
  activePathPrefix?: string;
  badge?: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  label: string;
}

export function LiquidNav({
  className,
  items,
  pathname,
  vertical = false,
}: {
  className?: string;
  items: LiquidNavItem[];
  pathname: string;
  vertical?: boolean;
}) {
  const router = useRouter();
  const [pendingRoute, setPendingRoute] = React.useState<{
    fromPath: string;
    href: string;
  } | null>(null);
  const pendingResetRef = React.useRef(0);
  const displayedPath =
    pendingRoute?.fromPath === pathname ? pendingRoute.href : pathname;

  React.useEffect(
    () => () => window.clearTimeout(pendingResetRef.current),
    [],
  );

  const acknowledgeNavigation = React.useCallback((href: string) => {
    setPendingRoute({ fromPath: pathname, href });
    window.clearTimeout(pendingResetRef.current);
    pendingResetRef.current = window.setTimeout(
      () => setPendingRoute(null),
      2_500,
    );
  }, [pathname]);
  const activeIndex = items.findIndex(
    (item) =>
      displayedPath === item.href ||
      displayedPath.startsWith(`${item.href}/`) ||
      Boolean(
        item.activePathPrefix &&
          (displayedPath === item.activePathPrefix ||
            displayedPath.startsWith(`${item.activePathPrefix}/`)),
      ),
  );

  return (
    <nav
      aria-label={t("common.primaryNavigation")}
      className={cn(
        "relative isolate",
        vertical ? "grid gap-1" : "flex items-stretch",
        className,
      )}
    >
      {items.map((item, index) => {
        const active = index === activeIndex;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "t-primary-nav-link relative z-10 flex min-h-10 min-w-0 items-center overflow-hidden rounded-[0.625rem] text-sm font-medium text-muted-foreground outline-none transition-[color,transform] duration-[var(--motion-quick)] ease-[var(--ease-smooth-out)] hover:bg-[var(--surface-hover)] hover:text-foreground active:scale-[.97] focus-visible:ring-2 focus-visible:ring-ring/40",
              vertical
                ? "gap-3 px-3"
                : "flex-1 flex-col justify-center gap-1 px-1 py-1.5 text-[0.6875rem]",
              active && "bg-secondary text-foreground shadow-[var(--shadow-control)]",
            )}
            data-liquid-nav-index={index}
            data-active={active}
            href={item.href}
            key={item.href}
            onClick={() => {
              if (item.href !== pathname) markRouteDirection("root");
              acknowledgeNavigation(item.href);
            }}
            onFocus={() => router.prefetch(item.href)}
            onPointerDown={() => acknowledgeNavigation(item.href)}
            onPointerEnter={() => router.prefetch(item.href)}
          >
            <span className="relative shrink-0">
              {item.icon}
              {item.badge}
            </span>
            <span
              className={cn(
                "w-full min-w-0 truncate",
                vertical ? "text-left" : "text-center",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
