"use client";

import type { VocabFolder } from "@/types";
import { BookMarked, ChevronLeft, ChevronRight, Folder, FolderOpen, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { ALL_FOLDER_ID, buildFolderOptions, UNCATEGORIZED_FOLDER_ID } from "@/src/lib/folders";
import { buildLibrarySetMetrics } from "@/src/lib/library-metrics";
import { buildQuestionId } from "@/src/lib/library";
import { readSetShare } from "@/src/lib/set-share";
import { createUniqueSetName } from "@/src/lib/set-name";

export function LibraryPage({ initialFolderId }: { initialFolderId?: string }) {
  const { state, status, error } = useLibraryStore();
  const createFolder = useLibraryStore((store) => store.createFolder);
  const renameFolder = useLibraryStore((store) => store.renameFolder);
  const moveFolder = useLibraryStore((store) => store.moveFolder);
  const deleteFolder = useLibraryStore((store) => store.deleteFolder);
  const saveSet = useLibraryStore((store) => store.saveSet);
  const saveQuestion = useLibraryStore((store) => store.saveQuestion);
  const cards = useLearningStore((store) => store.progress.cards);
  const setMetrics = useMemo(
    () => buildLibrarySetMetrics(state, cards),
    [cards, state],
  );
  const [query, setQuery] = useState("");
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId ?? ALL_FOLDER_ID);
  const [newFolder, setNewFolder] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [importing, setImporting] = useState(false);

  const currentFolder = state.folders.find((folder) => folder.id === currentFolderId && folder.id !== UNCATEGORIZED_FOLDER_ID);
  useEffect(() => { if (status === "ready" && currentFolderId !== ALL_FOLDER_ID && !currentFolder) setCurrentFolderId(ALL_FOLDER_ID); }, [currentFolder, currentFolderId, status]);
  const breadcrumbs = useMemo(() => buildBreadcrumbs(state.folders, currentFolder), [currentFolder, state.folders]);
  const childFolders = useMemo(() => state.folders
    .filter((folder) => folder.id !== UNCATEGORIZED_FOLDER_ID && folder.parentId === currentFolder?.id)
    .toSorted((a, b) => a.order - b.order || a.name.localeCompare(b.name)), [currentFolder, state.folders]);

  const sets = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const scope = currentFolder ? collectFolderIds(state.folders, currentFolder.id) : null;
    return state.sets.filter((entry) => {
      const inCurrentLocation = needle
        ? !scope || scope.has(entry.folderId)
        : currentFolder ? entry.folderId === currentFolder.id : !entry.folderId || entry.folderId === ALL_FOLDER_ID || entry.folderId === UNCATEGORIZED_FOLDER_ID;
      if (!inCurrentLocation) return false;
      if (!needle) return true;
      if (entry.setName.toLocaleLowerCase().includes(needle)) return true;
      return (state.memberships[entry.id] ?? []).some((membership) => {
        const word = state.words[membership.wordKey];
        return word?.word.toLocaleLowerCase().includes(needle) || word?.senses.some((sense) => sense.meaningZh.includes(needle) || sense.examples.some((example) => example.toLocaleLowerCase().includes(needle)));
      });
    });
  }, [currentFolder, query, state]);

  const importSet = async (file: File) => {
    setImporting(true);
    try {
      const payload = await readSetShare(file);
      const existingNames = new Set(state.sets.map(entry => entry.setName));
      let lastFolderId = currentFolder?.id;
      for (const sharedSet of payload.sets) {
        const wordsByKey = new Map(sharedSet.words.map(word => [word.wordKey, word]));
        const drafts = sharedSet.memberships.flatMap((membership) => {
          const word = wordsByKey.get(membership.wordKey);
          if (!word) return [];
          return membership.senseIds.flatMap((senseId) => {
            const sense = word.senses.find(entry => entry.id === senseId);
            return sense ? [{ word: word.word, pos: sense.pos, meaningZh: sense.meaningZh, examples: sense.examples }] : [];
          });
        });
        const setName = createUniqueSetName(sharedSet.setName, existingNames);
        existingNames.add(setName);
        const imported = await saveSet({ setName, folderId: currentFolder?.id, words: drafts });
        lastFolderId = imported.folderId;
        for (const question of sharedSet.questions) {
          await saveQuestion({ ...question, id: buildQuestionId() });
        }
      }
      if (currentFolder && lastFolderId) setCurrentFolderId(lastFolderId);
      toast.success(t("library.importDone", { count: payload.sets.length }));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      toast.error(t("library.importFailed", { message }));
    } finally {
      setImporting(false);
    }
  };

  const openFolder = (folderId: string) => { setCurrentFolderId(folderId); setQuery(""); setRenaming(false); setCreatingFolder(false); setFolderError(""); };
  const goUp = () => openFolder(currentFolder?.parentId ?? ALL_FOLDER_ID);
  const empty = status === "ready" && sets.length === 0 && (query.trim() || childFolders.length === 0);

  return (
    <div>
      <PageHeader title={t("library.title")} description={t("library.description")} actions={<><Button asChild variant="ghost"><label className={importing ? "cursor-wait opacity-60" : "cursor-pointer"} aria-disabled={importing}><Upload className="size-4" />{t(importing ? "library.importing" : "library.importSet")}<input type="file" accept=".zip" disabled={importing} className="sr-only" onChange={(event) => { const input = event.currentTarget; const file = input.files?.[0]; if (file) void importSet(file).finally(() => { input.value = ""; }); }} /></label></Button><Button asChild><Link href={currentFolder ? `/sets/new?folderId=${encodeURIComponent(currentFolder.id)}` : "/sets/new"}><Plus className="size-4" />{t("library.newSet")}</Link></Button></>} />

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex min-h-14 items-center gap-1 border-b px-3 sm:px-4">
          <Button type="button" size="icon" variant="ghost" className="size-9 min-h-9 shrink-0" disabled={!currentFolder} onClick={goUp} aria-label={t("library.backOneLevel")}><ChevronLeft className="size-4" /></Button>
          <nav className="flex min-w-0 flex-1 items-center overflow-x-auto" aria-label={t("library.folderPath")}>
            <Breadcrumb active={!currentFolder} label={t("library.rootName")} onClick={() => openFolder(ALL_FOLDER_ID)} />
            {breadcrumbs.map((folder, index) => <span key={folder.id} className="flex shrink-0 items-center"><ChevronRight className="size-3.5 text-muted-foreground" /><Breadcrumb active={index === breadcrumbs.length - 1} label={folder.name} onClick={() => openFolder(folder.id)} /></span>)}
          </nav>
          <Button type="button" variant="ghost" size="icon" className="size-9 min-h-9 shrink-0 sm:w-auto sm:px-3" onClick={() => { setCreatingFolder(true); setFolderError(""); }} aria-label={t("library.newFolder")}><Plus className="size-4" /><span className="hidden sm:inline">{t("library.newFolder")}</span></Button>
        </div>

        <div className="grid gap-3 border-b p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("library.searchHere")} className="pl-10" />
          </label>
          {currentFolder && <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" className="size-11" aria-label={t("library.renameFolder")} onClick={() => { setRenaming(true); setRenameValue(currentFolder.name); }}><Pencil className="size-4" /></Button><Button type="button" size="icon" variant="ghost" className="size-11" aria-label={t("library.deleteFolder")} onClick={() => setDeleteFolderId(currentFolder.id)}><Trash2 className="size-4" /></Button></div>}
        </div>

        {creatingFolder && <InlineFolderForm value={newFolder} error={folderError} onChange={setNewFolder} onCancel={() => { setCreatingFolder(false); setNewFolder(""); setFolderError(""); }} onSubmit={() => { if (!newFolder.trim()) return; setFolderError(""); void createFolder(newFolder, currentFolder?.id).then(() => { setNewFolder(""); setCreatingFolder(false); }).catch(() => setFolderError(t("library.folderNameConflict"))); }} />}
        {renaming && currentFolder && <div className="border-b bg-muted/40 px-4 py-3"><form className="flex max-w-md gap-2" onSubmit={(event) => { event.preventDefault(); if (!renameValue.trim()) return; void renameFolder(currentFolder.id, renameValue).then(() => setRenaming(false)).catch(() => setFolderError(t("library.folderNameConflict"))); }}><Input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /><Button type="submit" size="sm">{t("common.confirm")}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>{t("common.cancel")}</Button></form><label className="mt-3 block max-w-md"><span className="mb-1.5 block text-xs text-muted-foreground">{t("library.moveFolder")}</span><select value={currentFolder.parentId ?? ""} onChange={(event) => void moveFolder(currentFolder.id, event.target.value || undefined).catch(() => setFolderError(t("library.folderNameConflict")))} className="h-10 w-full rounded-xl border bg-card px-3 text-sm"><option value="">{t("library.rootFolder")}</option>{buildFolderOptions(state.folders).filter((folder) => folder.id !== currentFolder.id && folder.id !== UNCATEGORIZED_FOLDER_ID && !collectFolderIds(state.folders, currentFolder.id).has(folder.id)).map((folder) => <option key={folder.id} value={folder.id}>{folder.label}</option>)}</select></label>{folderError && <p className="mt-2 text-xs text-destructive" role="alert">{folderError}</p>}</div>}

        <div className="hidden grid-cols-[minmax(0,1fr)_180px_32px] border-b bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground sm:grid"><span>{t("library.nameColumn")}</span><span>{t("library.contentColumn")}</span><span /></div>
        {status === "loading" && <Status text={t("library.loading")} />}
        {status === "error" && <Status text={t("library.migrationError", { message: error ?? "" })} />}
        {status === "ready" && !query.trim() && childFolders.map((folder) => <FolderRow key={folder.id} folder={folder} itemCount={countDirectItems(state.folders, state.sets, folder.id)} onOpen={() => openFolder(folder.id)} />)}
        {status === "ready" && sets.map((entry) => {
          const metrics = setMetrics.get(entry.id) ?? { senseCount: 0, learned: 0, due: 0, questionCount: 0 };
          return <SetRow key={entry.id} id={entry.id} name={entry.setName} {...metrics} />;
        })}
        {empty && <EmptyLocation searching={Boolean(query.trim())} createHref={currentFolder ? `/sets/new?folderId=${encodeURIComponent(currentFolder.id)}` : "/sets/new"} />}
      </section>

      {deleteFolderId && (() => { const folder = state.folders.find((entry) => entry.id === deleteFolderId); const descendants = collectFolderIds(state.folders, deleteFolderId); const setCount = state.sets.filter((entry) => descendants.has(entry.folderId)).length; return <ConfirmDialog open onOpenChange={(open) => { if (!open) setDeleteFolderId(null); }} title={t("library.deleteFolder")} description={t("library.deleteFolderConfirm", { name: folder?.name ?? "", sets: setCount })} confirmLabel={t("library.deleteFolder")} onConfirm={async () => { await deleteFolder(deleteFolderId); setCurrentFolderId(ALL_FOLDER_ID); setDeleteFolderId(null); }} />; })()}
    </div>
  );
}

function Breadcrumb({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm ${active ? "font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</button>; }
function FolderRow({ folder, itemCount, onOpen }: { folder: VocabFolder; itemCount: number; onOpen: () => void }) { return <button type="button" onClick={onOpen} aria-label={t("library.openFolder", { name: folder.name })} className="grid w-full grid-cols-[minmax(0,1fr)_32px] items-center gap-3 border-b px-4 py-4 text-left last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid-cols-[minmax(0,1fr)_180px_32px] sm:px-5"><span className="flex min-w-0 items-center gap-3"><Folder className="size-5 shrink-0 fill-muted text-primary" /><span className="truncate font-medium">{folder.name}</span></span><span className="hidden text-xs text-muted-foreground sm:block">{t("library.itemCount", { count: itemCount })}</span><ChevronRight className="size-4 text-muted-foreground" /></button>; }
function SetRow({ id, name, senseCount, learned, due, questionCount }: { id: string; name: string; senseCount: number; learned: number; due: number; questionCount: number }) { return <Link href={`/sets/${id}`} className="group grid grid-cols-[minmax(0,1fr)_32px] items-center gap-3 border-b px-4 py-4 last:border-b-0 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid-cols-[minmax(0,1fr)_180px_32px] sm:px-5"><span className="flex min-w-0 items-center gap-3"><BookMarked className="size-5 shrink-0 text-muted-foreground" /><span className="min-w-0"><span className="block truncate font-medium group-hover:text-foreground">{name}</span><span className="mt-1 block truncate text-xs text-muted-foreground sm:hidden">{t("library.senseCount", { count: senseCount })} · {t("setDetail.dueCount", { count: due })}</span></span></span><span className="hidden text-xs leading-5 text-muted-foreground sm:block">{t("library.senseCount", { count: senseCount })} · {t("setDetail.learnedCount", { count: learned })}<br />{t("setDetail.dueCount", { count: due })} · {t("library.questionCount", { count: questionCount })}</span><ChevronRight className="size-4 text-muted-foreground" /></Link>; }
function InlineFolderForm({ value, error, onChange, onCancel, onSubmit }: { value: string; error: string; onChange: (value: string) => void; onCancel: () => void; onSubmit: () => void }) { return <div className="border-b bg-muted/40 px-4 py-3"><form className="flex max-w-md gap-2" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><Input autoFocus value={value} onChange={(event) => onChange(event.target.value)} placeholder={t("library.folderName")} /><Button type="submit" size="sm">{t("library.create")}</Button><Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button></form>{error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}</div>; }
function EmptyLocation({ searching, createHref }: { searching: boolean; createHref: string }) { return <div className="px-6 py-14 text-center"><FolderOpen className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">{searching ? t("library.noResults") : t("library.emptyFolderTitle")}</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{searching ? t("library.searchHint") : t("library.emptyFolderDescription")}</p>{!searching && <Button asChild className="mt-5"><Link href={createHref}><Plus className="size-4" />{t("library.newSet")}</Link></Button>}</div>; }
function Status({ text }: { text: string }) { return <div className="px-5 py-10 text-sm text-muted-foreground">{text}</div>; }

function buildBreadcrumbs(folders: VocabFolder[], current?: VocabFolder) { const path: VocabFolder[] = []; const byId = new Map(folders.map((folder) => [folder.id, folder])); let cursor = current; while (cursor) { path.unshift(cursor); cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined; } return path; }
function countDirectItems(folders: VocabFolder[], sets: Array<{ folderId: string }>, folderId: string) { return folders.filter((folder) => folder.parentId === folderId).length + sets.filter((entry) => entry.folderId === folderId).length; }
function collectFolderIds(folders: Array<{ id: string; parentId?: string }>, rootId: string) { const ids = new Set([rootId]); let changed = true; while (changed) { changed = false; for (const folder of folders) if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true; } } return ids; }
