import type { LibraryQuestion, StudyWord, WordEntry, WorkspacePracticeMode, WorkspaceQuestionDifficulty, WorkspaceQuestionType } from "@/types";

import { allocateDailyQuestionQuotas } from "@/src/lib/question-distribution";

export interface QuestionItem {
  id: string;
  question: LibraryQuestion;
  prompt: string;
  options: string[];
  answerIndex: number;
  senseId: string;
  type: "standard" | "fillBlank" | "reading";
  difficulty: 1 | 2 | 3;
  meaning: string;
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(values: T[], seed: string): T[] {
  const random = seededRandom(seed);
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function shuffleOptions(options: string[], answerIndex: number, seed: string): { options: string[]; answerIndex: number } {
  if (options.length < 2) return { options, answerIndex };
  const order = seededShuffle(options.map((_, index) => index), seed);
  return {
    options: order.map((index) => options[index] ?? ""),
    answerIndex: order.indexOf(answerIndex),
  };
}

function applyOptionShuffle(item: QuestionItem): QuestionItem {
  const shuffled = shuffleOptions(item.options, item.answerIndex, item.id);
  if (shuffled.answerIndex === item.answerIndex && shuffled.options.every((option, index) => option === item.options[index])) return item;
  return { ...item, options: shuffled.options, answerIndex: shuffled.answerIndex };
}

export function buildQuestionGroups(questions: LibraryQuestion[], words: Record<string, WordEntry>): QuestionItem[][] {
  const meaningBySense = new Map(
    Object.values(words).flatMap((word) => word.senses.map((sense) => [sense.id, sense.meaningZh] as const)),
  );
  return questions.map((question): QuestionItem[] => {
    if (question.kind === "reading") {
      return question.questions.map((child): QuestionItem => {
        const base: QuestionItem = {
          id: `reading:${question.id}:${child.id}`,
          question,
          prompt: child.prompt,
          options: child.options,
          answerIndex: child.answerIndex,
          senseId: child.senseId,
          type: "reading",
          difficulty: question.difficulty,
          meaning: meaningBySense.get(child.senseId) ?? "",
        };
        return applyOptionShuffle(base);
      });
    }
    const base: QuestionItem = {
      id: `question:${question.id}`,
      question,
      prompt: question.prompt,
      options: question.options,
      answerIndex: question.answerIndex,
      senseId: question.senseId,
      type: question.questionStyle,
      difficulty: question.difficulty,
      meaning: meaningBySense.get(question.senseId) ?? "",
    };
    return [applyOptionShuffle(base)];
  });
}

export function selectQuestionItems(
  allQuestionGroups: QuestionItem[][],
  allowedSenseIds: Set<string>,
  amount: number,
  questionType: WorkspaceQuestionType,
  difficulty: WorkspaceQuestionDifficulty,
): QuestionItem[] {
  const groups = allQuestionGroups
    .map((group) => group.filter((item) => allowedSenseIds.has(item.senseId)))
    .filter((group) => group.length > 0
      && (questionType === "all" || group[0]?.type === questionType)
      && (difficulty === "all" || group[0]?.difficulty === Number(difficulty)));
  const buckets = [1, 2, 3].map((level) => groups.filter((group) => group[0]?.difficulty === level));
  const orderedGroups: QuestionItem[][] = [];
  while (buckets.some((bucket) => bucket.length)) {
    for (const bucket of buckets) {
      const group = bucket.shift();
      if (group) orderedGroups.push(group);
    }
  }

  const result: QuestionItem[] = [];
  const usedSenses = new Set<string>();
  const usedGroups = new Set<QuestionItem[]>();
  const take = (group: QuestionItem[], target = amount) => {
    if (usedGroups.has(group) || result.length >= target) return false;
    usedGroups.add(group);
    result.push(...group);
    group.forEach((item) => usedSenses.add(item.senseId));
    return true;
  };
  const takeGroups = (candidates: QuestionItem[][], target: number) => {
    const end = result.length + target;
    for (const group of candidates) {
      if (!group.some((item) => usedSenses.has(item.senseId))) take(group, end);
      if (result.length >= end) break;
    }
    for (const group of candidates) {
      if (result.length >= end) break;
      take(group, end);
    }
  };

  if (questionType === "all") {
    const [standard, fillBlank, reading] = allocateDailyQuestionQuotas(amount);
    takeGroups(orderedGroups.filter((group) => group[0]?.type === "standard"), standard);
    takeGroups(orderedGroups.filter((group) => group[0]?.type === "fillBlank"), fillBlank);
    takeGroups(orderedGroups.filter((group) => group[0]?.type === "reading"), reading);
    if (result.length < amount) takeGroups(orderedGroups, amount - result.length);
  } else {
    takeGroups(orderedGroups, amount);
  }
  return result;
}

export function shuffleSession<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function buildWrongContent(
  mode: WorkspacePracticeMode,
  wrong: number[],
  activeReviews: StudyWord[],
  activeQuestions: QuestionItem[],
  answerChoices: ReadonlyArray<number | null> = [],
): string {
  if (!wrong.length) return "";
  return JSON.stringify({
    items: wrong.map((value) => {
      if (mode === "review") {
        const item = activeReviews[value];
        return { type: "review", word: item?.word ?? "", pos: item?.pos ?? "", meaning: item?.meaning ?? "", example: item?.example ?? "" };
      }
      const item = activeQuestions[value];
      const chosenIndex = answerChoices[value];
      const userAnswer = chosenIndex === null || chosenIndex === undefined ? "跳過，未作答" : item?.options[chosenIndex] ?? "未保存的選項";
      return {
        type: "question",
        questionType: item?.type ?? "standard",
        difficulty: item?.difficulty ?? 2,
        prompt: item?.prompt ?? "",
        options: item?.options ?? [],
        userAnswer,
        correctAnswer: item?.options[item.answerIndex] ?? "",
        meaning: item?.meaning ?? "",
        ...(item?.question.kind === "reading" ? { passage: item.question.passage } : {}),
      };
    }),
  }, null, 2);
}
