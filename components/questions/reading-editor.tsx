"use client";

import type { ReadingPack } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";

interface ChildDraft { id?: string; source: string; prompt: string; options: string[]; answerIndex: number }
const emptyChild = (): ChildDraft => ({ source: "", prompt: "", options: ["", "", "", ""], answerIndex: 0 });

export function ReadingEditor({ readingId }: { readingId?: string }) {
  const router = useRouter();
  const { state, saveQuestion } = useLibraryStore();
  const senses = useMemo(
    () => Object.values(state.words).flatMap((word) => word.senses.map((sense) => ({ value: `${word.wordKey}::${sense.id}`, label: `${word.word} · ${sense.meaningZh}` }))),
    [state.words],
  );
  const [title, setTitle] = useState(""); const [passage, setPassage] = useState(""); const [difficulty, setDifficulty] = useState<1|2|3>(2);
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild(), emptyChild(), emptyChild()]);
  const current = readingId ? state.questions.find((question) => question.id === readingId && question.kind === "reading") : undefined;
  useEffect(() => {
    if (!current || current.kind !== "reading") return;
    setTitle(current.title); setPassage(current.passage); setDifficulty(current.difficulty);
    setChildren(current.questions.map((child) => ({ id: child.id, source: `${child.wordKey}::${child.senseId}`, prompt: child.prompt, options: [...child.options], answerIndex: child.answerIndex })));
  }, [current]);
  const update = (index: number, value: Partial<ChildDraft>) => setChildren((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
  const submit = async () => {
    const timestamp = new Date().toISOString();
    const questions = children.map((child) => { const [wordKey, senseId] = child.source.split("::"); return { id: child.id ?? crypto.randomUUID(), kind: "multipleChoice" as const, prompt: child.prompt.trim(), options: child.options.map((option) => option.trim()), answerIndex: child.answerIndex, wordKey, senseId }; });
    const pack: ReadingPack = { id: current?.id ?? crypto.randomUUID(), fingerprint: current?.fingerprint ?? "pending", kind: "reading", difficulty, title, passage, wordKeys: [...new Set(questions.map((child) => child.wordKey))], questions, createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp };
    await saveQuestion(pack); router.push("/questions");
  };
  return <div className="mx-auto max-w-3xl"><PageHeader title={t("questions.newReading")} actions={<Button asChild variant="ghost"><Link href="/questions"><ArrowLeft className="size-4" />{t("common.back")}</Link></Button>} /><div className="grid gap-4"><Input aria-label={t("questions.readingTitle")} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("questions.readingTitle")} /><textarea aria-label={t("questions.passage")} value={passage} onChange={(event) => setPassage(event.target.value)} placeholder={t("questions.passage")} className="h-48 rounded-2xl border bg-card p-4 text-sm leading-7 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40" /><select aria-label={t("questions.difficulty", { level: "" })} value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value) as 1|2|3)} className="h-11 rounded-xl border bg-card px-3">{[1,2,3].map((value) => <option key={value}>{value}</option>)}</select></div><div className="mt-8 divide-y border-y">{children.map((child, index) => <section key={index} className="py-6"><h2 className="font-semibold">{t("questions.childPrompt", { index: index + 1 })}</h2><div className="mt-4 grid gap-3"><select aria-label={`${t("questions.childPrompt", { index: index + 1 })} · ${t("questions.selectSense")}`} value={child.source} onChange={(event) => update(index, { source: event.target.value })} className="h-11 rounded-xl border bg-card px-3"><option value="">{t("questions.selectSense")}</option>{senses.map((sense) => <option key={sense.value} value={sense.value}>{sense.label}</option>)}</select><Input aria-label={`${t("questions.childPrompt", { index: index + 1 })} · ${t("questions.prompt")}`} value={child.prompt} onChange={(event) => update(index, { prompt: event.target.value })} placeholder={t("questions.prompt")} /><div className="grid gap-2 sm:grid-cols-2">{child.options.map((option, optionIndex) => <Input aria-label={`${t("questions.childPrompt", { index: index + 1 })} · ${t("questions.optionLabel", { index: optionIndex + 1 })}`} key={optionIndex} value={option} onChange={(event) => update(index, { options: child.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) })} placeholder={t("questions.optionLabel", { index: optionIndex + 1 })} />)}</div><select aria-label={`${t("questions.childPrompt", { index: index + 1 })} · ${t("questions.correct")}`} value={child.answerIndex} onChange={(event) => update(index, { answerIndex: Number(event.target.value) })} className="h-11 rounded-xl border bg-card px-3">{[0,1,2,3].map((value) => <option key={value} value={value}>{t("questions.correct")} {value + 1}</option>)}</select></div></section>)}</div><div className="mt-7 flex justify-end"><Button onClick={() => void submit()} disabled={!title || !passage || children.some((child) => !child.source || !child.prompt || child.options.some((option) => !option))}>{t("questions.save")}</Button></div></div>;
}
