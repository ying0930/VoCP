"use client";

import type {
  Dispatch,
  SetStateAction,
} from "react";
import { useEffect } from "react";

import {
  PRACTICE_PREFERENCES_STORAGE_KEY,
  PRACTICE_SESSION_STORAGE_KEY,
} from "@/constants";
import type {
  WorkspacePracticeMode,
  WorkspaceQuestionDifficulty,
  WorkspaceQuestionType,
  PracticeSessionSnapshot,
  SetMembership,
  StudyWord,
} from "@/types";
import type { QuestionItem } from "@/components/practice/practice-content";
import { canRestorePracticeSession, parsePracticeSession } from "@/src/lib/practice-session";

export function useRestorePracticeSession({
  allQuestionItems,
  allStudyItems,
  enabled,
  initialMode,
  initialSet,
  memberships,
  restoreAttempted,
  sessionRestored,
  setIds,
  onRestore,
}: {
  allQuestionItems: QuestionItem[];
  allStudyItems: StudyWord[];
  enabled: boolean;
  initialMode: WorkspacePracticeMode;
  initialSet: string;
  memberships: Record<string, SetMembership[]>;
  restoreAttempted: { current: boolean };
  sessionRestored: { current: boolean };
  setIds: Set<string>;
  onRestore: (snapshot: PracticeSessionSnapshot, items: Array<QuestionItem | StudyWord>) => void;
}) {
  useEffect(() => {
    if (restoreAttempted.current || !enabled) return;
    restoreAttempted.current = true;
    const raw = localStorage.getItem(PRACTICE_SESSION_STORAGE_KEY);
    const saved = parsePracticeSession(raw);
    if (!saved) {
      if (raw) localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    if (!canRestorePracticeSession(saved, initialMode, initialSet)) return;

    const allowed = new Set(
      (saved.setId ? memberships[saved.setId] ?? [] : Object.values(memberships).flat())
        .flatMap((entry) => entry.senseIds),
    );
    const sourceItems = saved.mode === "review" ? allStudyItems : allQuestionItems;
    const itemsById = new Map(sourceItems.map((item) => [item.id, item]));
    const items = saved.itemIds.map((id) => itemsById.get(id));
    const invalidItems = items.some((item) => !item || !allowed.has(saved.mode === "review" ? (item as StudyWord).id : (item as QuestionItem).senseId));
    if ((saved.setId && !setIds.has(saved.setId)) || invalidItems) {
      localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    sessionRestored.current = true;
    onRestore(saved, items as Array<QuestionItem | StudyWord>);
  }, [allQuestionItems, allStudyItems, enabled, initialMode, initialSet, memberships, onRestore, restoreAttempted, sessionRestored, setIds]);
}

interface PreferenceValues {
  amount: number;
  difficulty: WorkspaceQuestionDifficulty;
  leechOnly: boolean;
  questionType: WorkspaceQuestionType;
  setId: string;
  typingMode: boolean;
}

type ValueSetter<T> = Dispatch<SetStateAction<T>>;

export function usePracticePreferences({
  initialSet,
  learningLoaded,
  started,
  values,
  setAmount,
  setDifficulty,
  setLeechOnly,
  setQuestionType,
  setSetId,
  setTypingMode,
}: {
  initialSet: string;
  learningLoaded: boolean;
  started: boolean;
  values: PreferenceValues;
  setAmount: ValueSetter<number>;
  setDifficulty: ValueSetter<WorkspaceQuestionDifficulty>;
  setLeechOnly: ValueSetter<boolean>;
  setQuestionType: ValueSetter<WorkspaceQuestionType>;
  setSetId: ValueSetter<string>;
  setTypingMode: ValueSetter<boolean>;
}) {
  const { amount, difficulty, leechOnly, questionType, setId, typingMode } = values;
  useEffect(() => {
    if (!learningLoaded || started) return;
    try {
      const saved = JSON.parse(localStorage.getItem(PRACTICE_PREFERENCES_STORAGE_KEY) ?? "{}") as Partial<PreferenceValues>;
      if (!initialSet && saved.setId) setSetId(saved.setId);
      if (saved.amount) setAmount(saved.amount);
      if (saved.questionType) setQuestionType(saved.questionType);
      if (saved.difficulty) setDifficulty(saved.difficulty);
      if (typeof saved.leechOnly === "boolean") setLeechOnly(saved.leechOnly);
      if (typeof saved.typingMode === "boolean") setTypingMode(saved.typingMode);
    } catch {
      // Corrupted preferences should never block practice.
    }
  }, [initialSet, learningLoaded, setAmount, setDifficulty, setLeechOnly, setQuestionType, setSetId, setTypingMode, started]);

  useEffect(() => {
    if (started) return;
    localStorage.setItem(PRACTICE_PREFERENCES_STORAGE_KEY, JSON.stringify({ setId, amount, questionType, difficulty, leechOnly, typingMode }));
  }, [amount, difficulty, leechOnly, questionType, setId, started, typingMode]);
}

export function usePersistPracticeSession({
  activeItems,
  amount,
  answerChoices,
  complete,
  correct,
  difficulty,
  failedSenseIds,
  index,
  marked,
  mode,
  questionType,
  retrying,
  revealed,
  selected,
  setId,
  skipped,
  started,
  wrong,
}: {
  activeItems: Array<{ id: string }>;
  amount: number;
  answerChoices: Array<number | null>;
  complete: boolean;
  correct: number;
  difficulty: WorkspaceQuestionDifficulty;
  failedSenseIds: string[];
  index: number;
  marked: number[];
  mode: WorkspacePracticeMode;
  questionType: WorkspaceQuestionType;
  retrying: boolean;
  revealed: boolean;
  selected: number | null;
  setId: string;
  skipped: number[];
  started: boolean;
  wrong: number[];
}) {
  useEffect(() => {
    if (!started) return;
    if (complete) {
      localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
      return;
    }
    const itemIds = activeItems.map((item) => item.id);
    if (!itemIds.length) return;
    localStorage.setItem(PRACTICE_SESSION_STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      mode,
      setId,
      amount,
      index,
      correct,
      wrong,
      skipped,
      marked,
      selected,
      revealed,
      questionType,
      difficulty,
      itemIds,
      failedSenseIds,
      retrying,
      answerChoices: mode === "questions" ? activeItems.map((_, position) => answerChoices[position] ?? null) : [],
    }));
  }, [activeItems, amount, answerChoices, complete, correct, difficulty, failedSenseIds, index, marked, mode, questionType, retrying, revealed, selected, setId, skipped, started, wrong]);
}
