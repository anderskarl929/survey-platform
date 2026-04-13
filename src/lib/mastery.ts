export interface ResponseRecord {
  questionId: number;
  isCorrect: boolean | null;
  createdAt: Date;
}

export function isQuestionMastered(
  questionId: number,
  responses: ResponseRecord[]
): boolean {
  const answers = responses
    .filter((r) => r.questionId === questionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (answers.length < 2) return false;

  const last2 = answers.slice(-2);
  return last2[0].isCorrect === true && last2[1].isCorrect === true;
}

export function calculateMastery(
  questionIds: number[],
  responses: ResponseRecord[]
): { masteredIds: number[]; remainingIds: number[] } {
  const masteredIds: number[] = [];
  const remainingIds: number[] = [];

  for (const id of questionIds) {
    if (isQuestionMastered(id, responses)) {
      masteredIds.push(id);
    } else {
      remainingIds.push(id);
    }
  }

  return { masteredIds, remainingIds };
}

const SPACING_DAYS = 2;

export function getSpacedReviewIds(
  questionIds: number[],
  responses: ResponseRecord[],
  now: Date = new Date()
): number[] {
  return questionIds.filter((id) => {
    if (isQuestionMastered(id, responses)) return false;

    const answers = responses
      .filter((r) => r.questionId === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (answers.length === 0) return false;

    const lastAnswer = answers[0];
    // Only surface questions where the last attempt was wrong or unsure
    if (lastAnswer.isCorrect === true) return false;

    const daysSince =
      (now.getTime() - lastAnswer.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= SPACING_DAYS;
  });
}
