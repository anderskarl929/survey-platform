import { prisma } from "@/lib/prisma";
import {
  AttemptRecord,
  PracticeCandidate,
  QuestionRelearningState,
  buildRelearningStates,
  summarizeStates,
} from "@/lib/relearning";

export interface RelearningData {
  states: Map<number, QuestionRelearningState>;
  candidates: PracticeCandidate[];
}

/**
 * Laddar elevens samlade försökshistorik (skarpa quiz-svar + övningsförsök)
 * för flervalsfrågor och beräknar ominlärningsstatus. Poolen = frågor eleven
 * någon gång missat (fel eller "Jag är inte säker").
 */
export async function loadRelearningData(
  studentId: number,
  now: Date = new Date()
): Promise<RelearningData> {
  const [answers, practice] = await Promise.all([
    prisma.answer.findMany({
      where: {
        response: { studentId },
        question: { type: "MULTIPLE_CHOICE" },
      },
      select: {
        questionId: true,
        isCorrect: true,
        response: { select: { createdAt: true } },
        question: { select: { topicId: true } },
      },
    }),
    prisma.practiceAttempt.findMany({
      where: { studentId },
      select: {
        questionId: true,
        isCorrect: true,
        createdAt: true,
        question: { select: { topicId: true } },
      },
    }),
  ]);

  const attempts: AttemptRecord[] = [
    ...answers.map((a) => ({
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      createdAt: a.response.createdAt,
    })),
    ...practice.map((p) => ({
      questionId: p.questionId,
      isCorrect: p.isCorrect,
      createdAt: p.createdAt,
    })),
  ];

  const topicByQuestion = new Map<number, number>();
  for (const a of answers) topicByQuestion.set(a.questionId, a.question.topicId);
  for (const p of practice) topicByQuestion.set(p.questionId, p.question.topicId);

  const states = buildRelearningStates(attempts, now);
  const candidates: PracticeCandidate[] = Array.from(states.keys()).map(
    (questionId) => ({
      questionId,
      topicId: topicByQuestion.get(questionId) ?? 0,
    })
  );

  return { states, candidates };
}

export interface StudentPracticeOverview {
  studentId: number;
  due: number;
  learning: number;
  graduated: number;
  attempts7d: number;
  lastPractice: Date | null;
}

export interface QuestionGapOverview {
  questionId: number;
  text: string;
  topicName: string;
  studentsInLearning: number;
  studentsDue: number;
}

export interface CourseRelearningOverview {
  byStudent: Map<number, StudentPracticeOverview>;
  questionGaps: QuestionGapOverview[];
  totals: {
    due: number;
    learning: number;
    graduated: number;
    activePractitioners7d: number;
    attempts7d: number;
  };
}

/**
 * Lärarvyn: ominlärningsläget för en hel kurs - per elev (pool, due,
 * aktivitet) och per fråga (hur många elever som har frågan som lucka).
 */
export async function loadCourseRelearningOverview(
  courseId: number,
  now: Date = new Date()
): Promise<CourseRelearningOverview> {
  const [answers, practice] = await Promise.all([
    prisma.answer.findMany({
      where: {
        response: { student: { courseId } },
        question: { type: "MULTIPLE_CHOICE" },
      },
      select: {
        questionId: true,
        isCorrect: true,
        response: { select: { studentId: true, createdAt: true } },
        question: {
          select: { text: true, topic: { select: { name: true } } },
        },
      },
    }),
    prisma.practiceAttempt.findMany({
      where: { student: { courseId } },
      select: {
        studentId: true,
        questionId: true,
        isCorrect: true,
        createdAt: true,
      },
    }),
  ]);

  // Frågemetadata för luck-listan (alla poolfrågor har minst ett quiz-svar)
  const questionMeta = new Map<number, { text: string; topicName: string }>();
  for (const a of answers) {
    if (!questionMeta.has(a.questionId)) {
      questionMeta.set(a.questionId, {
        text: a.question.text,
        topicName: a.question.topic.name,
      });
    }
  }

  // Försökshistorik per elev
  const attemptsByStudent = new Map<number, AttemptRecord[]>();
  function push(studentId: number, record: AttemptRecord) {
    const list = attemptsByStudent.get(studentId);
    if (list) list.push(record);
    else attemptsByStudent.set(studentId, [record]);
  }
  for (const a of answers) {
    push(a.response.studentId, {
      questionId: a.questionId,
      isCorrect: a.isCorrect,
      createdAt: a.response.createdAt,
    });
  }
  for (const p of practice) {
    push(p.studentId, {
      questionId: p.questionId,
      isCorrect: p.isCorrect,
      createdAt: p.createdAt,
    });
  }

  // Övningsaktivitet per elev (bara PracticeAttempt, inte skarpa quiz)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const activityByStudent = new Map<
    number,
    { attempts7d: number; lastPractice: Date | null }
  >();
  for (const p of practice) {
    const act = activityByStudent.get(p.studentId) ?? {
      attempts7d: 0,
      lastPractice: null,
    };
    if (p.createdAt >= weekAgo) act.attempts7d++;
    if (act.lastPractice === null || p.createdAt > act.lastPractice) {
      act.lastPractice = p.createdAt;
    }
    activityByStudent.set(p.studentId, act);
  }

  const byStudent = new Map<number, StudentPracticeOverview>();
  const gapCounters = new Map<
    number,
    { studentsInLearning: number; studentsDue: number }
  >();
  const totals = {
    due: 0,
    learning: 0,
    graduated: 0,
    activePractitioners7d: 0,
    attempts7d: 0,
  };

  for (const [studentId, records] of attemptsByStudent) {
    const states = buildRelearningStates(records, now);
    const summary = summarizeStates(states);
    const activity = activityByStudent.get(studentId) ?? {
      attempts7d: 0,
      lastPractice: null,
    };

    byStudent.set(studentId, {
      studentId,
      due: summary.due,
      learning: summary.learning,
      graduated: summary.graduated,
      attempts7d: activity.attempts7d,
      lastPractice: activity.lastPractice,
    });

    totals.due += summary.due;
    totals.learning += summary.learning;
    totals.graduated += summary.graduated;
    totals.attempts7d += activity.attempts7d;
    if (activity.attempts7d > 0) totals.activePractitioners7d++;

    for (const s of states.values()) {
      if (s.status !== "learning") continue;
      const counter = gapCounters.get(s.questionId) ?? {
        studentsInLearning: 0,
        studentsDue: 0,
      };
      counter.studentsInLearning++;
      if (s.due) counter.studentsDue++;
      gapCounters.set(s.questionId, counter);
    }
  }

  const questionGaps: QuestionGapOverview[] = Array.from(gapCounters.entries())
    .map(([questionId, c]) => ({
      questionId,
      text: questionMeta.get(questionId)?.text ?? `Fråga ${questionId}`,
      topicName: questionMeta.get(questionId)?.topicName ?? "",
      studentsInLearning: c.studentsInLearning,
      studentsDue: c.studentsDue,
    }))
    .sort(
      (a, b) =>
        b.studentsInLearning - a.studentsInLearning ||
        a.text.localeCompare(b.text, "sv")
    );

  return { byStudent, questionGaps, totals };
}
