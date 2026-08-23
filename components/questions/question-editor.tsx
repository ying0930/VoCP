"use client";

import type { LibraryQuestion, MultipleChoiceQuestion } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { useLibraryStore } from "@/stores/library-store";

interface Values { questionStyle: "standard" | "fillBlank"; difficulty: 1 | 2 | 3; source: string; prompt: string; option0: string; option1: string; option2: string; option3: string; answerIndex: number; explanation: string }

export function QuestionEditor({ questionId }: { questionId?: string }) {
  const router = useRouter();
  const { state, saveQuestion } = useLibraryStore();
  const current = questionId ? state.questions.find((entry) => entry.id === questionId) : undefined;
  const senses = useMemo(
    () => Object.values(state.words).flatMap((word) => word.senses.map((sense) => ({ value: `${word.wordKey}::${sense.id}`, label: `${word.word} · ${sense.pos} ${sense.meaningZh}` }))),
    [state.words],
  );
  const form = useForm<Values>({ defaultValues: { questionStyle: "standard", difficulty: 1, source: senses[0]?.value ?? "", prompt: "", option0: "", option1: "", option2: "", option3: "", answerIndex: 0, explanation: "" } });

  useEffect(() => {
    if (!current || current.kind === "reading") return;
    form.reset({ questionStyle: current.questionStyle, difficulty: current.difficulty, source: `${current.wordKey}::${current.senseId}`, prompt: current.prompt, option0: current.options[0] ?? "", option1: current.options[1] ?? "", option2: current.options[2] ?? "", option3: current.options[3] ?? "", answerIndex: current.answerIndex, explanation: current.explanation ?? "" });
  }, [current, form]);
  useEffect(() => {
    if (!current && senses[0] && !form.getValues("source")) form.setValue("source", senses[0].value);
  }, [current, form, senses]);

  const submit = form.handleSubmit(async (values) => {
    const [wordKey, senseId] = values.source.split("::");
    const timestamp = new Date().toISOString();
    const question: MultipleChoiceQuestion = { id: current?.id ?? crypto.randomUUID(), fingerprint: current?.fingerprint ?? "pending", kind: "multipleChoice", questionStyle: values.questionStyle, difficulty: Number(values.difficulty) as 1 | 2 | 3, wordKey, senseId, prompt: values.prompt.trim(), options: [values.option0, values.option1, values.option2, values.option3].map((value) => value.trim()), answerIndex: Number(values.answerIndex), explanation: values.explanation.trim() || undefined, createdAt: current?.createdAt ?? timestamp, updatedAt: timestamp };
    await saveQuestion(question as LibraryQuestion);
    router.push("/questions");
  });

  return <form onSubmit={submit} className="mx-auto max-w-3xl"><PageHeader title={questionId ? t("questions.edit") : t("questions.new")} actions={<Button asChild variant="ghost"><Link href="/questions"><ArrowLeft className="size-4" />{t("common.back")}</Link></Button>} />
    <div className="grid gap-5 rounded-xl bg-muted p-6 sm:grid-cols-2"><Field label={t("questions.type")}><select {...form.register("questionStyle")} className="h-11 w-full rounded-xl border bg-card px-3"><option value="standard">{t("questions.standard")}</option><option value="fillBlank">{t("questions.fillBlank")}</option></select></Field><Field label={t("questions.linkedSense")}><select {...form.register("source", { required: true })} className="h-11 w-full rounded-xl border bg-card px-3">{senses.map((sense) => <option key={sense.value} value={sense.value}>{sense.label}</option>)}</select></Field><Field label={t("questions.difficulty", { level: "" })}><select {...form.register("difficulty", { valueAsNumber: true })} className="h-11 w-full rounded-xl border bg-card px-3"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></Field></div>
    <div className="mt-7 grid gap-5"><Field label={t("questions.prompt")}><Input {...form.register("prompt", { required: true })} /></Field><div className="grid gap-4 sm:grid-cols-2">{[0,1,2,3].map((index) => <Field key={index} label={t("questions.optionLabel", { index: index + 1 })}><Input {...form.register(`option${index}` as keyof Values, { required: true })} /></Field>)}</div><Field label={t("questions.correct")}><select {...form.register("answerIndex", { valueAsNumber: true })} className="h-11 w-full rounded-xl border bg-card px-3">{[0,1,2,3].map((index) => <option key={index} value={index}>{index + 1}</option>)}</select></Field><Field label={t("questions.explanation")}><Input {...form.register("explanation")} /></Field></div><div className="mt-7 flex justify-end"><Button type="submit">{t("questions.save")}</Button></div>
  </form>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>; }
