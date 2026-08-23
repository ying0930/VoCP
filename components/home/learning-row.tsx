"use client";

import { ArrowRight, BookMarked, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";
import { parsePracticeSession } from "@/src/lib/practice-session";
import type { PracticeSessionSnapshot } from "@/types";

export function LearningRows() {
  const state = useLibraryStore((store) => store.state);
  const [session, setSession] = useState<PracticeSessionSnapshot | null>(null);
  useEffect(() => { setSession(parsePracticeSession(localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY))); }, []);
  const recentSets = useMemo(
    () => state.sets
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3)
      .map((entry) => ({
        id: entry.id,
        name: entry.setName,
        count: (state.memberships[entry.id] ?? []).reduce(
          (sum, item) => sum + item.senseIds.length,
          0,
        ),
      })),
    [state.memberships, state.sets],
  );
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18.75rem,0.8fr)] lg:gap-10">
      {session && <section>
        <h2 className="text-lg font-semibold tracking-[-0.02em]">{t("home.resumeTitle")}</h2>
        <div className="mt-3 flex items-center gap-3 border-y py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><Play className="size-[1.125rem] fill-current" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{state.sets.find((entry) => entry.id === session.setId)?.setName ?? t("practice.allSets")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{session.index} / {session.itemIds.length}</div>
          </div>
          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-border sm:block"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, session.itemIds.length ? session.index / session.itemIds.length * 100 : 0)}%` }} /></div>
          <Button asChild variant="ghost" size="sm"><Link href="/practice">{t("home.resumeAction")}<ArrowRight className="size-4" /></Link></Button>
        </div>
      </section>}

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{t("home.recentTitle")}</h2>
          <Link href="/library" className="text-sm font-medium text-primary hover:text-foreground">{t("home.viewAll")}</Link>
        </div>
        <div className="mt-3 divide-y border-y">
          {recentSets.map((set) => (
            <Link key={set.id} href={`/sets/${set.id}`} className="group flex items-center gap-3 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              <BookMarked className="size-5 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold group-hover:text-foreground">{set.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t("home.wordCount", { count: set.count })}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
