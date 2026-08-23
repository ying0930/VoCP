import type { CardProgress, LibraryState, WordEntry } from "@/types";

import { isDue } from "@/src/lib/fsrs";

export interface LibrarySetMetrics {
  due: number;
  learned: number;
  questionCount: number;
  senseCount: number;
}

export function countReviewableSenses(
  words: Record<string, WordEntry>,
  cards: Record<string, CardProgress>,
  now = new Date(),
): number {
  let count = 0;
  for (const word of Object.values(words)) {
    for (const sense of word.senses) {
      if (!cards[sense.id] || isDue(cards[sense.id], now)) count += 1;
    }
  }
  return count;
}

export function countQuestionItems(state: LibraryState): number {
  let count = 0;
  for (const question of state.questions) {
    count += question.kind === "reading" ? question.questions.length : 1;
  }
  return count;
}

export function buildLibrarySetMetrics(
  state: LibraryState,
  cards: Record<string, CardProgress>,
  now = new Date(),
): Map<string, LibrarySetMetrics> {
  const metrics = new Map<string, LibrarySetMetrics>();
  const setIdsBySense = new Map<string, Set<string>>();

  for (const set of state.sets) {
    const senseIds = new Set(
      (state.memberships[set.id] ?? []).flatMap((membership) => membership.senseIds),
    );
    let learned = 0;
    let due = 0;

    for (const senseId of senseIds) {
      const card = cards[senseId];
      if (card) learned += 1;
      if (card && isDue(card, now)) due += 1;

      const setIds = setIdsBySense.get(senseId) ?? new Set<string>();
      setIds.add(set.id);
      setIdsBySense.set(senseId, setIds);
    }

    metrics.set(set.id, {
      due,
      learned,
      questionCount: 0,
      senseCount: senseIds.size,
    });
  }

  for (const question of state.questions) {
    const senseIds = question.kind === "reading"
      ? question.questions.map((child) => child.senseId)
      : [question.senseId];
    const affectedSetIds = new Set<string>();
    for (const senseId of senseIds) {
      for (const setId of setIdsBySense.get(senseId) ?? []) affectedSetIds.add(setId);
    }
    for (const setId of affectedSetIds) {
      const current = metrics.get(setId);
      if (current) current.questionCount += 1;
    }
  }

  return metrics;
}
