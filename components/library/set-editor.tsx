"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { WordAssistant } from "@/components/library/word-assistant";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { buildSenseId, normalizePartOfSpeech, normalizeWordKey } from "@/src/lib/library";
import type { LibraryState } from "@/types";

const wordSchema = z.object({
  word: z.string().trim().min(1),
  pos: z.string().trim().min(1),
  meaningZh: z.string().trim().min(1),
  example: z.string(),
  originalWordKey: z.string().optional(),
  originalSenseId: z.string().optional(),
});

const formSchema = z.object({
  setName: z.string().trim().min(1),
  folderId: z.string(),
  words: z.array(wordSchema).min(1),
});

type FormValues = z.infer<typeof formSchema>;
const emptyWord = { word: "", pos: "", meaningZh: "", example: "", originalWordKey: "", originalSenseId: "" };

function getSetWords(state: LibraryState, setId: string): FormValues["words"] {
  return (state.memberships[setId] ?? []).flatMap((membership) => {
    const word = state.words[membership.wordKey];
    if (!word) return [];
    return membership.senseIds.flatMap((senseId) => {
      const sense = word.senses.find((entry) => entry.id === senseId);
      return sense ? [{ word: word.word, pos: sense.pos, meaningZh: sense.meaningZh, example: sense.examples.join("\n"), originalWordKey: word.wordKey, originalSenseId: sense.id }] : [];
    });
  });
}

export function SetEditor({ setId, initialFolderId }: { setId?: string; initialFolderId?: string }) {
  const router = useRouter();
  const { state, status, saveSet } = useLibraryStore();
  const current = setId ? state.sets.find((entry) => entry.id === setId) : undefined;
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { setName: setId ? "" : t("setEditor.defaultSetName"), folderId: initialFolderId ?? UNCATEGORIZED_FOLDER_ID, words: [emptyWord] } });
  const fields = useFieldArray({ control: form.control, name: "words" });
  const [showAssistant, setShowAssistant] = useState(false);
  const [pendingHref, setPendingHref] = useState("");
  const setName = form.watch("setName");

  useEffect(() => {
    if (!current) return;
    const words = getSetWords(state, current.id);
    form.reset({ setName: current.setName, folderId: current.folderId, words: words.length ? words : [emptyWord] });
  }, [current, form, state.memberships, state.words]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (!form.formState.isDirty) return; event.preventDefault(); };
    window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect);
  }, [form.formState.isDirty]);
  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      if (!form.formState.isDirty || event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.dataset.allowDiscard === "true" || anchor.origin !== window.location.origin) return;
      event.preventDefault(); setPendingHref(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    };
    document.addEventListener("click", intercept, true); return () => document.removeEventListener("click", intercept, true);
  }, [form.formState.isDirty]);

  const submit = form.handleSubmit(async (values) => {
    const defaultName = t("setEditor.defaultSetName").toLocaleLowerCase();
    const defaultSet = !setId && values.setName.trim().toLocaleLowerCase() === defaultName
      ? state.sets.find((entry) => entry.setName.trim().toLocaleLowerCase() === defaultName)
      : undefined;
    const targetSetId = setId ?? defaultSet?.id;
    if (state.sets.some((entry) => entry.id !== targetSetId && entry.setName.trim().toLocaleLowerCase() === values.setName.trim().toLocaleLowerCase())) {
      form.setError("setName", { message: t("setEditor.duplicateName") });
      return;
    }
    const remaps = values.words.flatMap((word) => {
      if (!word.originalWordKey || !word.originalSenseId) return [];
      const newWordKey = normalizeWordKey(word.word);
      const pos = normalizePartOfSpeech(word.pos) || word.pos.trim();
      const newSenseId = buildSenseId(newWordKey, pos, word.meaningZh.trim());
      if (word.originalWordKey === newWordKey && word.originalSenseId === newSenseId) return [];
      return [{ oldWordKey: word.originalWordKey, oldSenseId: word.originalSenseId, newWordKey, newSenseId }];
    });
    const words = defaultSet ? [...getSetWords(state, defaultSet.id), ...values.words] : values.words;
    const folderId = defaultSet && values.folderId === UNCATEGORIZED_FOLDER_ID ? defaultSet.folderId : values.folderId;
    const saved = await saveSet({ id: targetSetId, setName: values.setName, folderId, words: words.map((word) => ({ word: word.word, pos: word.pos, meaningZh: word.meaningZh, examples: word.example.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) })), remaps });
    if (remaps.length) await useLearningStore.getState().remapSenses(remaps);
    router.push(`/sets/${saved.id}`);
  });

  const metadataFields = (
    <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
      <Field label={t("setEditor.name")} error={form.formState.errors.setName?.message ?? (form.formState.errors.setName && t("setEditor.required"))}><Input {...form.register("setName")} placeholder={t("setEditor.namePlaceholder")} /></Field>
      <Field label={t("setEditor.folder")}>
        <select {...form.register("folderId")} className="h-11 w-full rounded-xl border bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40">
          <option value={UNCATEGORIZED_FOLDER_ID}>{t("library.uncategorized")}</option>
          {state.folders.filter((folder) => folder.id !== UNCATEGORIZED_FOLDER_ID).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
      </Field>
    </div>
  );

  return (
    <form onSubmit={submit}>
      <Link data-allow-discard="true" href={setId ? `/sets/${setId}` : initialFolderId ? `/library?folderId=${encodeURIComponent(initialFolderId)}` : "/library"} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"><ArrowLeft className="size-4" />{t("setEditor.cancel")}</Link>
      <PageHeader title={t(setId ? "setEditor.editTitle" : "setEditor.createTitle")} description={setId ? undefined : t("setEditor.quickDescription")} />
      <div className="mx-auto max-w-3xl">
        {setId ? (
          <div className="rounded-xl bg-muted p-5 sm:p-7">{metadataFields}</div>
        ) : (
          <details className="group rounded-xl border bg-card px-4 py-3.5 open:bg-muted sm:px-5">
            <summary className="cursor-pointer list-none text-sm font-medium marker:content-none">
              <span className="flex items-center justify-between gap-3">
                <span>{t("setEditor.organizationSummary", { name: setName || t("setEditor.defaultSetName") })}</span>
                <span className="text-xs text-muted-foreground group-open:hidden">{t("setEditor.organize")}</span>
              </span>
            </summary>
            <div className="mt-5 border-t pt-5">{metadataFields}</div>
          </details>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold tracking-[-0.02em]">{t("setEditor.words")}</h2><div className="flex flex-wrap gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setShowAssistant((value) => !value)}><Sparkles className="size-4" />{t("setEditor.aiAssist")}</Button><Button type="button" variant="secondary" size="sm" onClick={() => fields.append(emptyWord)}><Plus className="size-4" />{t("setEditor.addWord")}</Button></div></div>
        {showAssistant && <WordAssistant onClose={() => setShowAssistant(false)} onApply={(rows) => { const currentRows = form.getValues("words"); const firstIsEmpty = currentRows.length === 1 && !currentRows[0].word && !currentRows[0].meaningZh; const normalized = rows.map((row) => ({ ...row, originalWordKey: "", originalSenseId: "" })); if (firstIsEmpty) fields.replace(normalized); else fields.append(normalized); }} />}
        <div className="mt-4 divide-y border-y">
          {fields.fields.map((field, index) => (
            <section key={field.id} className="py-6">
              <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
                <Field label={t("setEditor.word")} error={form.formState.errors.words?.[index]?.word && t("setEditor.required")}><Input autoFocus={!setId && index === 0} {...form.register(`words.${index}.word`)} placeholder={t("setEditor.wordPlaceholder")} /></Field>
                <Field label={t("setEditor.pos")} error={form.formState.errors.words?.[index]?.pos && t("setEditor.required")}><Input {...form.register(`words.${index}.pos`)} placeholder={t("setEditor.posPlaceholder")} /></Field>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label={t("setEditor.meaning")} error={form.formState.errors.words?.[index]?.meaningZh && t("setEditor.required")}><Input {...form.register(`words.${index}.meaningZh`)} placeholder={t("setEditor.meaningPlaceholder")} /></Field>
                <Field label={`${t("setEditor.examples")} · ${t("setEditor.examplesHint")}`}><textarea {...form.register(`words.${index}.example`)} placeholder={t("setEditor.examplePlaceholder")} className="min-h-24 w-full resize-y rounded-xl border bg-card px-3.5 py-3 text-sm outline-none placeholder:text-muted-foreground/65 focus-visible:border-ring focus:ring-2 focus-visible:ring-ring/40" /></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => fields.insert(index + 1, { ...emptyWord, word: form.getValues(`words.${index}.word`) })} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"><Plus className="size-3.5" />{t("setEditor.addSense")}</button>{fields.fields.length > 1 && <button type="button" onClick={() => fields.remove(index)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-xs font-medium text-muted-foreground hover:text-red-700 focus-visible:ring-2 focus-visible:ring-ring/40"><Trash2 className="size-3.5" />{t("setEditor.removeWord")}</button>}</div>
            </section>
          ))}
        </div>
        <div className="sticky bottom-[max(0.75rem,var(--safe-bottom))] z-20 -mx-2 mt-7 flex justify-end rounded-2xl bg-background/88 p-2 shadow-[var(--shadow-floating)] backdrop-blur-xl sm:mx-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none"><Button type="submit" size="lg" className="w-full sm:w-auto" disabled={form.formState.isSubmitting || status !== "ready"}>{form.formState.isSubmitting ? t("setEditor.saving") : t(setId ? "setEditor.save" : "setEditor.saveWord")}</Button></div>
      </div>
      <ConfirmDialog open={Boolean(pendingHref)} onOpenChange={(open) => { if (!open) setPendingHref(""); }} title={t("setEditor.unsavedTitle")} description={t("setEditor.unsavedDescription")} confirmLabel={t("setEditor.discard")} onConfirm={() => { const href = pendingHref; setPendingHref(""); router.push(href); }} />
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string | false; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-muted-foreground">{label}</span>{children}{error && <span className="mt-1.5 block text-xs text-red-700">{error}</span>}</label>;
}
