"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { QuestionItem } from "@/components/practice/practice-content";
import { shuffleSession } from "@/components/practice/practice-content";
import { PRACTICE_SESSION_STORAGE_KEY } from "@/constants";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { isSameLocalDay } from "@/src/lib/date";
import type {
  CardProgress,
  ReviewRating,
  StudyWord,
  WorkspacePracticeMode,
} from "@/types";

type Setter<T> = Dispatch<SetStateAction<T>>;

interface SessionSetters {
  setAnswerChoices: Setter<Array<number | null>>;
  setCorrect: Setter<number>;
  setIndex: Setter<number>;
  setMarked: Setter<number[]>;
  setMode: Setter<WorkspacePracticeMode>;
  setQuestionFailedSenses: Setter<string[]>;
  setRetrying: Setter<boolean>;
  setRevealed: Setter<boolean>;
  setSelected: Setter<number | null>;
  setSessionQuestions: Setter<QuestionItem[] | null>;
  setSessionReviews: Setter<StudyWord[] | null>;
  setSkipped: Setter<number[]>;
  setStarted: Setter<boolean>;
  setWrong: Setter<number[]>;
}

export function usePracticeSessionActions({
  activeQuestions,
  activeReviews,
  index,
  mode,
  progressCards,
  questionFailedSenses,
  questionItems,
  retrying,
  reviewItems,
  selected,
  setters,
}: {
  activeQuestions: QuestionItem[];
  activeReviews: StudyWord[];
  index: number;
  mode: WorkspacePracticeMode;
  progressCards: Record<string, CardProgress>;
  questionFailedSenses: string[];
  questionItems: QuestionItem[];
  retrying: boolean;
  reviewItems: StudyWord[];
  selected: number | null;
  setters: SessionSetters;
}) {
  const [actionBusy, setActionBusy] = useState(false);
  const [animateNextCard, setAnimateNextCard] = useState(true);
  const actionPending = useRef(false);
  const rateSense = useLearningStore((store) => store.rateSense);
  const scheduleSenseFromQuestion = useLearningStore((store) => store.scheduleSenseFromQuestion);
  const recordQuestion = useLearningStore((store) => store.recordQuestion);

  const resetAttempt = () => {
    actionPending.current = false;
    setActionBusy(false);
    setters.setIndex(0);
    setters.setCorrect(0);
    setters.setWrong([]);
    setters.setSkipped([]);
    setters.setMarked([]);
    setters.setSelected(null);
    setters.setRevealed(false);
    setters.setAnswerChoices([]);
  };

  const advance = (fromKeyboard = false) => {
    setAnimateNextCard(!fromKeyboard);
    setters.setIndex((value) => value + 1);
    setters.setRevealed(false);
    setters.setSelected(null);
  };

  const next = (fromKeyboard = false) => {
    if (!actionPending.current) advance(fromKeyboard);
  };

  const rate = async (rating: ReviewRating, fromKeyboard = false) => {
    const item = activeReviews[index];
    if (!item || actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      await rateSense(item.id, rating);
      if (rating === "good") setters.setCorrect((value) => value + 1);
      else setters.setWrong((value) => [...value, index]);
      advance(fromKeyboard);
    } catch (reason) {
      console.error(reason);
      toast.error(t("practice.recordFailed"));
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };

  const answer = async (choice: number) => {
    if (selected !== null || actionPending.current) return;
    const item = activeQuestions[index];
    if (!item) return;
    actionPending.current = true;
    setActionBusy(true);
    const isCorrect = choice === item.answerIndex;
    setters.setSelected(choice);
    setters.setRevealed(true);
    setters.setAnswerChoices((values) => {
      const nextChoices = [...values];
      while (nextChoices.length <= index) nextChoices.push(null);
      nextChoices[index] = choice;
      return nextChoices;
    });
    if (isCorrect) setters.setCorrect((value) => value + 1);
    else setters.setWrong((value) => [...value, index]);
    const addedFailedSense = !isCorrect && !questionFailedSenses.includes(item.senseId);
    if (addedFailedSense) setters.setQuestionFailedSenses((values) => [...values, item.senseId]);
    try {
      const card = progressCards[item.senseId];
      const reviewedToday = card?.lastReview ? isSameLocalDay(new Date(card.lastReview), new Date()) : false;
      if (addedFailedSense) await scheduleSenseFromQuestion(item.senseId, "again");
      else if (isCorrect && !reviewedToday) await scheduleSenseFromQuestion(item.senseId, "good");
      await recordQuestion(item.senseId, item.type, item.difficulty, isCorrect, retrying);
    } catch (reason) {
      console.error(reason);
      toast.error(t("practice.recordFailed"));
      setters.setSelected(null);
      setters.setRevealed(false);
      if (isCorrect) setters.setCorrect((value) => Math.max(0, value - 1));
      else setters.setWrong((values) => values.filter((value) => value !== index));
      if (addedFailedSense) setters.setQuestionFailedSenses((values) => values.filter((id) => id !== item.senseId));
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };

  const skip = async () => {
    const item = activeQuestions[index];
    if (!item || selected !== null || actionPending.current) return;
    actionPending.current = true;
    setActionBusy(true);
    try {
      setters.setSkipped((values) => [...values, index]);
      setters.setWrong((values) => [...values, index]);
      await recordQuestion(item.senseId, item.type, item.difficulty, false, retrying);
      advance();
    } catch (reason) {
      console.error(reason);
      toast.error(t("practice.recordFailed"));
      setters.setSkipped((values) => values.filter((value) => value !== index));
      setters.setWrong((values) => values.filter((value) => value !== index));
    } finally {
      actionPending.current = false;
      setActionBusy(false);
    }
  };

  const begin = () => {
    setters.setSessionReviews(mode === "review" ? shuffleSession(reviewItems) : null);
    setters.setSessionQuestions(mode === "questions" ? shuffleSession(questionItems) : null);
    setters.setRetrying(false);
    setters.setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
    setters.setStarted(true);
  };

  const leave = () => {
    localStorage.removeItem(PRACTICE_SESSION_STORAGE_KEY);
    setters.setStarted(false);
    setters.setSessionReviews(null);
    setters.setSessionQuestions(null);
    setters.setRetrying(false);
    setters.setQuestionFailedSenses([]);
    resetAttempt();
  };

  const retry = (indices: number[]) => {
    setters.setSessionReviews(mode === "review" ? indices.map((value) => activeReviews[value]).filter(Boolean) : null);
    setters.setSessionQuestions(mode === "questions" ? indices.map((value) => activeQuestions[value]).filter(Boolean) : null);
    setters.setRetrying(true);
    setters.setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
  };

  const continueQuestions = () => {
    setters.setMode("questions");
    setters.setSessionReviews(null);
    setters.setSessionQuestions(shuffleSession(questionItems));
    setters.setRetrying(false);
    setters.setQuestionFailedSenses([]);
    setAnimateNextCard(true);
    resetAttempt();
  };

  return {
    actionBusy,
    animateNextCard,
    answer,
    begin,
    continueQuestions,
    leave,
    next,
    rate,
    retry,
    skip,
  };
}
