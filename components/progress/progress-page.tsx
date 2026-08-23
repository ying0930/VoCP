"use client";

import { BarChart3, Brain, Flame, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { isDue } from "@/src/lib/fsrs";
import { emptyQuestionStats } from "@/src/lib/learning-defaults";

export function ProgressPage() {
  const { stats, progress, loaded } = useLearningStore();
  const library = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const [setId, setSetId] = useState("");
  const allSenseIds = useMemo(
    () => setId ? (library.memberships[setId] ?? []).flatMap((entry) => entry.senseIds) : Object.values(library.words).flatMap((word) => word.senses.map((sense) => sense.id)),
    [library.memberships, library.words, setId],
  );
  const learned = useMemo(() => allSenseIds.filter((id) => progress.cards[id]).length, [allSenseIds, progress.cards]);
  const due = useMemo(() => allSenseIds.filter((id) => progress.cards[id] && isDue(progress.cards[id])).length, [allSenseIds, progress.cards]);
  const memoryAccuracy = stats.totalMemoryReviews ? Math.round(stats.correctMemoryReviews / stats.totalMemoryReviews * 100) : 0;
  const questionAccuracy = stats.totalQuestionReviews ? Math.round(stats.correctQuestionReviews / stats.totalQuestionReviews * 100) : 0;
  const history = useMemo(() => Object.values(stats.dailyHistory).sort((a,b) => a.date.localeCompare(b.date)).slice(-14), [stats.dailyHistory]);
  const questionStats = useMemo(() => setId ? allSenseIds.reduce((result, senseId) => { const row = stats.questionStatsBySense[senseId]; if (!row) return result; for (const key of Object.keys(result) as Array<keyof typeof result>) { result[key].total += row[key].total; result[key].correct += row[key].correct; result[key].retry += row[key].retry; } return result; }, emptyQuestionStats()) : stats.questionStats, [allSenseIds, setId, stats.questionStats, stats.questionStatsBySense]);
  if (!loaded || libraryStatus !== "ready") return <div className="py-20 text-center text-sm text-muted-foreground">{t("progress.loading")}</div>;
  return <div><PageHeader title={t("progress.title")} description={t("progress.description")} actions={<select value={setId} onChange={(event) => setSetId(event.target.value)} className="h-11 rounded-xl border bg-card px-3 text-sm"><option value="">{t("progress.allSets")}</option>{library.sets.map((entry) => <option key={entry.id} value={entry.id}>{entry.setName}</option>)}</select>} /><div className="grid grid-cols-2 gap-x-6 gap-y-8 border-y py-7 sm:grid-cols-3 lg:grid-cols-6"><Metric icon={Trophy} label={t("progress.xp")} value={stats.xp} /><Metric icon={Flame} label={t("progress.level")} value={stats.level} /><Metric icon={Flame} label={t("progress.streak")} value={stats.streakDays} /><Metric icon={Brain} label={t("progress.memoryAccuracy")} value={`${memoryAccuracy}%`} /><Metric icon={BarChart3} label={t("progress.questionAccuracy")} value={`${questionAccuracy}%`} /><Metric icon={BarChart3} label={t("progress.questionReviews")} value={stats.totalQuestionReviews} /></div><div className="mt-10 grid gap-8 sm:grid-cols-2"><div className="rounded-xl bg-muted p-6"><div className="text-sm text-muted-foreground">{t("progress.learned")}</div><div className="mt-2 text-4xl font-semibold">{learned}</div></div><div className="rounded-xl bg-muted p-6"><div className="text-sm text-muted-foreground">{t("progress.due")}</div><div className="mt-2 text-4xl font-semibold">{due}</div></div></div><section className="mt-12"><h2 className="text-xl font-semibold">{t("progress.questionBreakdown")}</h2><div className="mt-4 divide-y border-y">{Object.entries(questionStats).map(([key, row]) => <div key={key} className="flex items-center gap-4 py-3 text-sm"><span className="flex-1 font-medium">{questionStatLabel(key)}</span><span className="text-muted-foreground">{t("progress.attempts", { count: row.total })}</span><span className="w-12 text-right font-semibold">{row.total ? Math.round(row.correct / row.total * 100) : 0}%</span></div>)}</div></section><section className="mt-12"><h2 className="text-xl font-semibold">{t("progress.history")}</h2>{history.length === 0 ? <p className="mt-5 border-y py-8 text-sm text-muted-foreground">{t("progress.noActivity")}</p> : <div className="mt-5 flex h-48 items-end gap-2 border-b pb-2">{history.map((day) => { const total = day.memoryAgain + day.memoryGood + day.questionTotal; return <div key={day.date} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div title={`${day.date}: ${total}`} className="w-full max-w-10 rounded-t-lg bg-primary" style={{ height: `${Math.max(8, Math.min(160, total * 8))}px` }} /><span className="hidden text-[10px] text-muted-foreground sm:block">{day.date.slice(5)}</span></div>; })}</div>}</section></div>;
}
function Metric({ icon: Icon, label, value }: { icon: typeof Trophy; label: string; value: string | number }) { return <div><Icon className="size-5 text-primary" /><div className="mt-3 text-3xl font-semibold tracking-[-0.03em]">{value}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>; }
function questionStatLabel(key: string) { const [type, level] = key.split(":"); const label = type === "standard" ? t("questions.standard") : type === "fillBlank" ? t("questions.fillBlank") : t("questions.reading"); return `${label} · ${t("questions.difficulty", { level })}`; }
