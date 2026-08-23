"use client";

import type { ReviewRating, StudyWord, WorkspacePracticeMode } from "@/types";
import { Bookmark, Check, SkipForward, Volume2, X } from "lucide-react";
import { motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { QuestionItem } from "@/components/practice/practice-content";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

const practiceTransition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };
const SWIPE_THRESHOLD = 72;

export function PracticeSessionView({
  mode,
  index,
  total,
  progressRatio,
  review,
  question,
  revealed,
  selected,
  marked,
  busy,
  animateCard,
  typing,
  onLeave,
  onReveal,
  onRate,
  onToggleMark,
  onSkip,
  onAnswer,
  onNext,
}: {
  mode: WorkspacePracticeMode;
  index: number;
  total: number;
  progressRatio: number;
  review?: StudyWord;
  question?: QuestionItem;
  revealed: boolean;
  selected: number | null;
  marked: boolean;
  busy: boolean;
  animateCard: boolean;
  typing: boolean;
  onLeave: () => void;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
  onToggleMark: () => void;
  onSkip: () => void;
  onAnswer: (choice: number) => void;
  onNext: () => void;
}) {
  const activeId = mode === "review" ? review?.id : question?.id;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <button type="button" onClick={onLeave} className="-my-2 inline-flex min-h-11 items-center rounded-lg px-2 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40">
          {t("common.back")}
        </button>
        <span className="tabular-nums">{t("practice.progress", { current: index + 1, total })}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <motion.div className="h-full origin-left rounded-full bg-primary" initial={false} animate={{ scaleX: progressRatio }} transition={practiceTransition} />
      </div>
      <motion.div
        key={`${mode}:${activeId ?? index}`}
        initial={animateCard ? { opacity: 0.72, y: 7 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={practiceTransition}
      >
        {mode === "review" && review ? (
          <ReviewCard item={review} revealed={revealed} busy={busy} typing={typing} onReveal={onReveal} onRate={onRate} />
        ) : question ? (
          <>
            <div className="mt-4 flex justify-end gap-1">
              <Button className="min-h-11 sm:min-h-9" size="sm" variant={marked ? "secondary" : "ghost"} onClick={onToggleMark}>
                <Bookmark className="size-4" />{t("practice.mark")}
              </Button>
              {selected === null && (
                <Button className="min-h-11 sm:min-h-9" size="sm" variant="ghost" disabled={busy} onClick={onSkip}>
                  <SkipForward className="size-4" />{t("practice.skip")}
                </Button>
              )}
            </div>
            <QuestionCard item={question} selected={selected} busy={busy} last={index === total - 1} onAnswer={onAnswer} onNext={onNext} />
          </>
        ) : null}
      </motion.div>
      <KeyboardHints mode={mode} revealed={revealed} answered={selected !== null} typing={typing} />
    </div>
  );
}

function KeyboardHints({ mode, revealed, answered, typing }: { mode: WorkspacePracticeMode; revealed: boolean; answered: boolean; typing: boolean }) {
  return (
    <div aria-hidden className="mt-6 hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground md:flex">
      {mode === "review" && !typing && !revealed && <ShortcutHint keys="Enter" label={t("practice.reveal")} />}
      {mode === "review" && !typing && revealed && <ShortcutHint keys="A" label={t("practice.again")} />}
      {mode === "review" && !typing && revealed && <ShortcutHint keys="G" label={t("practice.good")} />}
      {mode === "questions" && !answered && <ShortcutHint keys="1 – 4" label={t("practice.shortcutAnswer")} />}
      {mode === "questions" && answered && <ShortcutHint keys="Enter" label={t("practice.next")} />}
    </div>
  );
}

function ShortcutHint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[0.6875rem] text-foreground">{keys}</kbd>
      {label}
    </span>
  );
}

function ReviewCard({ item, revealed, busy, typing, onReveal, onRate }: { item: StudyWord; revealed: boolean; busy: boolean; typing: boolean; onReveal: () => void; onRate: (rating: ReviewRating) => void }) {
  const reduceMotion = useReducedMotion();
  const draggable = revealed && !busy && !reduceMotion;
  const x = useMotionValue(0);
  const againOpacity = useTransform(x, [-SWIPE_THRESHOLD, -16], [1, 0]);
  const goodOpacity = useTransform(x, [16, SWIPE_THRESHOLD], [0, 1]);
  const [typedValue, setTypedValue] = useState("");
  const [typedResult, setTypedResult] = useState<"correct" | "incorrect" | null>(null);
  const advanceTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(item.word));
  };
  const submitTyped = () => {
    if (!typedValue.trim() || typedResult || busy) return;
    const matches = typedValue.trim().toLocaleLowerCase() === item.word.trim().toLocaleLowerCase();
    setTypedResult(matches ? "correct" : "incorrect");
    if (matches) {
      advanceTimer.current = window.setTimeout(() => onRate("good"), 450);
      return;
    }
    onReveal();
  };
  const showWord = !typing || revealed;
  return (
    <motion.div
      className="relative mt-6"
      style={draggable ? { x, cursor: "grab" } : undefined}
      drag={draggable ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.x < -SWIPE_THRESHOLD) onRate("again");
        else if (info.offset.x > SWIPE_THRESHOLD) onRate("good");
      }}
    >
      <motion.span
        aria-hidden
        style={{ opacity: againOpacity }}
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-white"
      >
        {t("practice.again")}
      </motion.span>
      <motion.span
        aria-hidden
        style={{ opacity: goodOpacity }}
        className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-white"
      >
        {t("practice.good")}
      </motion.span>
      <section className="rounded-2xl bg-muted/70 px-5 py-9 text-center sm:px-8 sm:py-11">
        {showWord && (
          <>
            <button type="button" aria-label={t("practice.speak")} onClick={speak} className="mx-auto mb-5 grid size-11 place-items-center rounded-full bg-card text-primary shadow-[var(--shadow-control)] transition-transform duration-150 active:scale-[.94] focus-visible:ring-2 focus-visible:ring-ring/40">
              <Volume2 className="size-4" />
            </button>
            <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{item.word}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{item.pos}</p>
          </>
        )}
        {typing && !revealed ? (
          <>
            <h1 className="text-xl font-semibold leading-7 sm:text-2xl">{item.meaning}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{item.pos}</p>
            <form
              className="mx-auto mt-8 flex max-w-sm gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitTyped();
              }}
            >
              <input
                autoFocus
                value={typedValue}
                onChange={(event) => setTypedValue(event.target.value)}
                placeholder={t("practice.typingPlaceholder")}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
                aria-label={t("practice.typingPlaceholder")}
                className="h-11 min-w-0 flex-1 rounded-xl border bg-card px-3.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Button type="submit" disabled={busy || !typedValue.trim()}>{t("practice.begin")}</Button>
            </form>
            <button type="button" onClick={onReveal} className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("practice.typingShowAnswer")}
            </button>
          </>
        ) : revealed ? (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={practiceTransition}>
            {typing && typedResult && (
              <p className={`mt-6 text-sm font-semibold ${typedResult === "correct" ? "text-success" : "text-destructive"}`} aria-live="polite">
                {typedResult === "correct" ? `✓ ${t("practice.typingCorrect")}` : `${t("practice.typingIncorrect")} ${item.word}`}
              </p>
            )}
            <div className={`mx-auto h-px max-w-sm bg-primary/10 ${typing ? "my-5" : "my-7"}`} />
            {!showWord && (
              <>
                <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{item.word}</h1>
                <p className="mt-2 text-sm text-muted-foreground">{item.pos}</p>
              </>
            )}
            <p className="text-lg font-semibold tracking-[-0.01em]">{item.meaning}</p>
            {item.example && <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{item.example}</p>}
            <div className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-2">
              <Button size="lg" variant="secondary" disabled={busy} onClick={() => onRate("again")}>{t("practice.again")}</Button>
              <Button size="lg" disabled={busy} onClick={() => onRate("good")}>{busy ? t("practice.recording") : t("practice.good")}</Button>
            </div>
            {!reduceMotion && <p className="mt-3 text-xs text-muted-foreground">{t("practice.swipeHint")}</p>}
          </motion.div>
        ) : (
          <Button className="mt-9" size="lg" onClick={onReveal}>{t("practice.reveal")}</Button>
        )}
      </section>
    </motion.div>
  );
}

function QuestionCard({ item, selected, busy, last, onAnswer, onNext }: { item: QuestionItem; selected: number | null; busy: boolean; last: boolean; onAnswer: (choice: number) => void; onNext: () => void }) {
  const answered = selected !== null;
  return (
    <section className="mt-5 rounded-2xl bg-muted/70 p-5 sm:p-7">
      {item.question.kind === "reading" && (
        <div className="mb-6 border-b pb-6">
          <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{item.question.passage}</p>
        </div>
      )}
      <h1 className="max-w-2xl text-[1.0625rem] font-semibold leading-7 tracking-[-0.01em] sm:text-lg">{item.prompt}</h1>
      <div className="mt-6 grid gap-2.5">
        {item.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === item.answerIndex;
          const isSelected = selected === optionIndex;
          const stateClass = answered && isCorrect
            ? "border-success/25 bg-success/10 text-foreground"
            : answered && isSelected
              ? "border-destructive/30 bg-destructive/10 text-foreground"
              : "border-border bg-card hover:border-foreground/20 hover:bg-card/80";
          const badgeClass = answered && isCorrect
            ? "bg-success text-white"
            : answered && isSelected
              ? "bg-destructive text-white"
              : "bg-muted text-muted-foreground";
          return (
            <button
              key={optionIndex}
              type="button"
              disabled={answered || busy}
              onClick={() => onAnswer(optionIndex)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[.99] disabled:cursor-default disabled:opacity-100 ${stateClass}`}
            >
              <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold transition-colors duration-150 ${badgeClass}`}>{String.fromCharCode(65 + optionIndex)}</span>
              <span className="min-w-0 flex-1 leading-6">{option}</span>
              {answered && isCorrect && <Check className="size-4 shrink-0 text-success" />}
              {answered && isSelected && !isCorrect && <X className="size-4 shrink-0 text-destructive" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <motion.div className="mt-6 border-t pt-5" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={practiceTransition} aria-live="polite">
          <p className={`flex items-center gap-2 text-sm font-semibold ${selected === item.answerIndex ? "text-success" : "text-destructive"}`}>
            {selected === item.answerIndex ? <Check className="size-4" /> : <X className="size-4" />}
            {selected === item.answerIndex ? t("practice.correct") : t("practice.incorrect")}
          </p>
          {selected !== item.answerIndex && <p className="mt-2 text-sm text-foreground">{t("practice.answer", { answer: item.options[item.answerIndex] ?? "" })}</p>}
          {item.meaning && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.meaning}</p>}
          <div className="mt-5 flex justify-end">
            <Button className="w-full sm:w-auto" size="lg" disabled={busy} onClick={onNext}>
              {busy ? t("practice.recording") : t(last ? "practice.viewResult" : "practice.next")}
            </Button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
