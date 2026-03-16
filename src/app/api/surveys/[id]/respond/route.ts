import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respondSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { getStudentSession } from "@/lib/student-session";
import { Prisma } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const surveyId = Number(id);
    if (isNaN(surveyId)) {
      return NextResponse.json({ error: "Ogiltigt enkät-ID" }, { status: 400 });
    }

    const session = await getStudentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Du måste vara inloggad för att svara." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { answers } = respondSchema.parse(body);

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        course: true,
        questions: {
          include: { question: { include: { options: true } } },
        },
      },
    });
    if (!survey) {
      return NextResponse.json(
        { error: "Enkät hittades inte" },
        { status: 404 }
      );
    }

    // Verify student belongs to this course
    if (survey.courseId !== session.courseId) {
      return NextResponse.json(
        { error: "Du har inte tillgång till denna enkät." },
        { status: 403 }
      );
    }

    // Validate that answers reference questions that belong to this survey
    const surveyQuestionIds = new Set(survey.questions.map((sq) => sq.questionId));
    const invalidAnswers = answers.filter((a) => !surveyQuestionIds.has(a.questionId));
    if (invalidAnswers.length > 0) {
      return NextResponse.json(
        { error: "Vissa svar refererar till frågor som inte ingår i enkäten" },
        { status: 400 }
      );
    }

    // Build answer data, computing isCorrect for quiz mode
    const isQuiz = survey.mode === "QUIZ";
    const answerData = answers.map((a) => {
      let isCorrect: boolean | null = null;
      if (isQuiz) {
        const sq = survey.questions.find(
          (sq) => sq.questionId === a.questionId
        );
        if (sq && sq.question.type === "MULTIPLE_CHOICE") {
          const correctOption = sq.question.options.find((o) => o.isCorrect);
          isCorrect = correctOption ? a.value === correctOption.text : null;
        }
      }
      return { questionId: a.questionId, value: a.value, isCorrect };
    });

    // Use try/catch with unique constraint to prevent race condition
    let response;
    try {
      response = await prisma.response.create({
        data: {
          surveyId,
          studentId: session.studentId,
          answers: { create: answerData },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const target = (error.meta?.target as string[]) ?? [];
        if (target.includes("surveyId") || target.includes("studentId")) {
          return NextResponse.json(
            { error: "Du har redan svarat på denna enkät." },
            { status: 409 }
          );
        }
      }
      throw error;
    }

    // Calculate score for quiz
    let score = null;
    if (isQuiz) {
      const correct = answerData.filter((a) => a.isCorrect === true).length;
      const total = answerData.filter((a) => a.isCorrect !== null).length;
      score = {
        correct,
        total,
        percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    }

    // Return quiz results with correct answers for immediate feedback
    // Fetch saved answers to get their IDs
    const savedAnswers = await prisma.answer.findMany({
      where: { responseId: response.id },
      select: { id: true, questionId: true },
    });
    const answerIdMap = new Map(
      savedAnswers.map((a) => [a.questionId, a.id])
    );

    let quizResults = null;
    if (isQuiz) {
      quizResults = answerData.map((a) => {
        const sq = survey.questions.find(
          (sq) => sq.questionId === a.questionId
        );
        const correctOption = sq?.question.options.find((o) => o.isCorrect);
        return {
          answerId: answerIdMap.get(a.questionId) ?? null,
          questionId: a.questionId,
          questionText: sq?.question.text,
          questionType: sq?.question.type,
          yourAnswer: a.value,
          isCorrect: a.isCorrect,
          correctAnswer: correctOption?.text || null,
        };
      });
    }

    // For surveys (non-quiz), also return answer IDs for feedback
    let surveyResults = null;
    if (!isQuiz) {
      surveyResults = answerData.map((a) => {
        const sq = survey.questions.find(
          (sq) => sq.questionId === a.questionId
        );
        return {
          answerId: answerIdMap.get(a.questionId) ?? null,
          questionId: a.questionId,
          questionText: sq?.question.text,
          questionType: sq?.question.type,
          yourAnswer: a.value,
        };
      });
    }

    return NextResponse.json(
      { success: true, responseId: response.id, score, quizResults, surveyResults },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
