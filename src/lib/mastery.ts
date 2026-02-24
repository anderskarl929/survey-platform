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
