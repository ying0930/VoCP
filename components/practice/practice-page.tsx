"use client";

import type { PracticeSessionSnapshot, StudyWord, WorkspacePracticeMode, WorkspaceQuestionDifficulty, WorkspaceQuestionType } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildQuestionGroups,
  buildWrongContent,
  type QuestionItem,
  selectQuestionItems,
} from "@/components/practice/practice-content";
import { ResultPanel } from "@/components/practice/result-panel";
import { PracticeSessionView } from "@/components/practice/practice-session-view";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { usePracticeKeyboard } from "@/components/practice/use-practice-keyboard";
import { usePersistPracticeSession, usePracticePreferences, useRestorePracticeSession } from "@/components/practice/use-practice-persistence";
import { usePracticeSessionActions } from "@/components/practice/use-practice-session-actions";
import { t } from "@/lib/i18n";
import { useLearningStore } from "@/stores/learning-store";
import { useLibraryStore } from "@/stores/library-store";
import { useUIStore } from "@/stores/ui-store";
import { isDue, isLeech } from "@/src/lib/fsrs";
import { senseToStudyWord } from "@/src/lib/library";

type Mode = WorkspacePracticeMode;
type QuestionType = WorkspaceQuestionType;
type Difficulty = WorkspaceQuestionDifficulty;

export function PracticePage({ initialMode = "review", initialSet = "", initialAutoStart = false }: { initialMode?: Mode; initialSet?: string; initialAutoStart?: boolean }) {
  const state = useLibraryStore((store) => store.state);
  const libraryStatus = useLibraryStore((store) => store.status);
  const progress = useLearningStore((store) => store.progress);
  const learningLoaded = useLearningStore((store) => store.loaded);
  const setPracticeActive = useUIStore((store) => store.setPracticeActive);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [setId, setSetId] = useState(initialSet);
  const [amount, setAmount] = useState(10);
  const [questionType, setQuestionType] = useState<QuestionType>("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [leechOnly, setLeechOnly] = useState(false);
  const [typingMode, setTypingMode] = useState(false);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [marked, setMarked] = useState<number[]>([]);
  const [sessionQuestions, setSessionQuestions] = useState<QuestionItem[] | null>(null);
  const [sessionReviews, setSessionReviews] = useState<StudyWord[] | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [questionFailedSenses, setQuestionFailedSenses] = useState<string[]>([]);
  const [answerChoices, setAnswerChoices] = useState<Array<number | null>>([]);
  const restoreAttempted = useRef(false);
  const sessionRestored = useRef(false);
  const autoStartAttempted = useRef(false);

  const allowedSenseIds = useMemo(
    () => new Set((setId ? state.memberships[setId] ?? [] : Object.values(state.memberships).flat()).flatMap((entry) => entry.senseIds)),
    [setId, state.memberships],
  );
  const studyItems = useMemo(
    () => Object.values(state.words).flatMap((word) => word.senses.filter((sense) => allowedSenseIds.has(sense.id)).map((sense) => senseToStudyWord(word, sense))),
    [allowedSenseIds, state.words],
  );
  const allStudyItems = useMemo(
    () => Object.values(state.words).flatMap((word) => word.senses.map((sense) => senseToStudyWord(word, sense))),
    [state.words],
  );
  const reviewItems = useMemo(() => {
    const pool = leechOnly ? studyItems.filter((item) => isLeech(progress.cards[item.id] ?? null)) : studyItems;
    const due = pool
      .filter((item) => progress.cards[item.id] && isDue(progress.cards[item.id]))
      .sort((a, b) => new Date(progress.cards[a.id].due).getTime() - new Date(progress.cards[b.id].due).getTime());
    const fresh = pool.filter((item) => !progress.cards[item.id]);
    const freshLimit = due.length ? Math.ceil(amount / 3) : amount;
    return [...due.slice(0, amount - Math.min(freshLimit, fresh.length)), ...fresh.slice(0, freshLimit)].slice(0, amount);
  }, [amount, leechOnly, progress.cards, studyItems]);
  const allQuestionGroups = useMemo(() => buildQuestionGroups(state.questions, state.words), [state.questions, state.words]);
  const allQuestionItems = useMemo(() => allQuestionGroups.flat(), [allQuestionGroups]);
  const questionItems = useMemo(
    () => selectQuestionItems(allQuestionGroups, allowedSenseIds, amount, questionType, difficulty),
    [allQuestionGroups, allowedSenseIds, amount, difficulty, questionType],
  );
  const setIds = useMemo(() => new Set(state.sets.map((entry) => entry.id)), [state.sets]);

  const activeReviews = started ? sessionReviews ?? [] : reviewItems;
  const activeQuestions = started ? sessionQuestions ?? [] : questionItems;
  const total = mode === "review" ? activeReviews.length : activeQuestions.length;
  const complete = started && index >= total;
  const hasWords = Object.keys(state.words).length > 0;
  const completedSteps = mode === "questions" && selected !== null ? index + 1 : index;
  const progressRatio = total ? Math.min(1, completedSteps / total) : 0;
  const wrongContent = buildWrongContent(mode, wrong, activeReviews, activeQuestions, answerChoices);

  useEffect(() => {
    setPracticeActive(started && !complete);
    return () => setPracticeActive(false);
  }, [complete, setPracticeActive, started]);

  const restoreSession = useCallback((saved: PracticeSessionSnapshot, items: Array<QuestionItem | StudyWord>) => {
    setMode(saved.mode);
    setSetId(saved.setId);
    setAmount(saved.amount);
    setIndex(saved.index);
    setCorrect(saved.correct);
    setWrong(saved.wrong);
    setSkipped(saved.skipped);
    setMarked(saved.marked);
    setSelected(saved.selected);
    setRevealed(saved.revealed);
    setQuestionType(saved.questionType);
    setDifficulty(saved.difficulty);
    setRetrying(saved.retrying);
    setQuestionFailedSenses(saved.failedSenseIds);
    setAnswerChoices(saved.answerChoices);
    if (saved.mode === "review") setSessionReviews(items as StudyWord[]);
    else setSessionQuestions(items as QuestionItem[]);
    setStarted(true);
  }, []);

  useRestorePracticeSession({
    allQuestionItems,
    allStudyItems,
    enabled: libraryStatus === "ready" && learningLoaded,
    initialMode,
    initialSet,
    memberships: state.memberships,
    restoreAttempted,
    sessionRestored,
    setIds,
    onRestore: restoreSession,
  });

  usePracticePreferences({
    initialSet,
    learningLoaded,
    started: started || sessionRestored.current,
    values: { setId, amount, questionType, difficulty, leechOnly, typingMode },
    setAmount,
    setDifficulty,
    setLeechOnly,
    setQuestionType,
    setSetId,
    setTypingMode,
  });
  usePersistPracticeSession({
    activeItems: mode === "review" ? activeReviews : activeQuestions,
    amount,
    answerChoices,
    complete,
    correct,
    difficulty,
    failedSenseIds: questionFailedSenses,
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
  });

  const actions = usePracticeSessionActions({
    activeQuestions,
    activeReviews,
    index,
    mode,
    progressCards: progress.cards,
    questionFailedSenses,
    questionItems,
    retrying,
    reviewItems,
    selected,
    setters: { setAnswerChoices, setCorrect, setIndex, setMarked, setMode, setQuestionFailedSenses, setRetrying, setRevealed, setSelected, setSessionQuestions, setSessionReviews, setSkipped, setStarted, setWrong },
  });

  useEffect(() => {
    if (
      !initialAutoStart
      || autoStartAttempted.current
      || sessionRestored.current
      || !restoreAttempted.current
      || libraryStatus !== "ready"
      || !learningLoaded
      || started
    ) return;
    autoStartAttempted.current = true;
    const available = mode === "review" ? reviewItems.length : questionItems.length;
    if (available) actions.begin();
  }, [initialAutoStart, learningLoaded, libraryStatus, mode, questionItems.length, reviewItems.length, started]);
  usePracticeKeyboard({
    enabled: started && !complete,
    mode,
    revealed,
    selected,
    busy: actions.actionBusy,
    onReveal: () => setRevealed(true),
    onRate: (rating) => void actions.rate(rating, true),
    onAnswer: (choice) => void actions.answer(choice),
    onNext: () => actions.next(true),
  });

  if (libraryStatus !== "ready" || !learningLoaded) {
    return <div className="py-20 text-center text-sm text-muted-foreground">{t("library.loading")}</div>;
  }

  if (!started) {
    return (
      <PracticeSetup
        mode={mode}
        setId={setId}
        amount={amount}
        questionType={questionType}
        difficulty={difficulty}
        leechOnly={leechOnly}
        typingMode={typingMode}
        sets={state.sets}
        availableCount={mode === "review" ? reviewItems.length : questionItems.length}
        hasWords={hasWords}
        onModeChange={setMode}
        onSetChange={setSetId}
        onAmountChange={setAmount}
        onQuestionTypeChange={setQuestionType}
        onDifficultyChange={setDifficulty}
        onLeechOnlyChange={setLeechOnly}
        onTypingModeChange={setTypingMode}
        onBegin={actions.begin}
      />
    );
  }

  if (complete) {
    return (
      <ResultPanel
        correct={correct}
        total={total}
        skipped={skipped.length}
        marked={marked.length}
        wrongContent={wrongContent}
        onRetry={() => actions.retry(wrong)}
        onRetryMarked={marked.length ? () => actions.retry(marked) : undefined}
        onContinueQuestions={mode === "review" && questionItems.length ? actions.continueQuestions : undefined}
      />
    );
  }

  return (
    <PracticeSessionView
      mode={mode}
      index={index}
      total={total}
      progressRatio={progressRatio}
      review={mode === "review" ? activeReviews[index] : undefined}
      question={mode === "questions" ? activeQuestions[index] : undefined}
      revealed={revealed}
      selected={selected}
      marked={marked.includes(index)}
      busy={actions.actionBusy}
      animateCard={actions.animateNextCard}
      typing={mode === "review" && typingMode}
      onLeave={actions.leave}
      onReveal={() => setRevealed(true)}
      onRate={(rating) => void actions.rate(rating)}
      onToggleMark={() => setMarked((values) => values.includes(index) ? values.filter((value) => value !== index) : [...values, index])}
      onSkip={() => void actions.skip()}
      onAnswer={(choice) => void actions.answer(choice)}
      onNext={() => actions.next()}
    />
  );
}
