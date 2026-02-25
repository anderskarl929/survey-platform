import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respondSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
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

    const body = await request.json();
    const { studentNumber, courseCode, answers } = respondSchema.parse(body);

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

    // Verify course code matches
    if (survey.course.code !== courseCode) {
      return NextResponse.json({ error: "Ogiltig kurskod" }, { status: 403 });
    }

    // Find or verify student exists in this course
    const student = await prisma.student.findUnique({
      where: {
        courseId_number: { courseId: survey.courseId, number: studentNumber },
      },
    });
    if (!student) {
      return NextResponse.json(
        {
          error:
            "Elevnumret finns inte i denna kurs. Kontakta din lärare.",
        },
        { status: 404 }
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
    // instead of check-then-create which has a TOCTOU gap
    let response;
    try {
      response = await prisma.response.create({
        data: {
          surveyId,
          studentId: student.id,
          answers: { create: answerData },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Du har redan svarat på denna enkät." },
          { status: 409 }
        );
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
    let quizResults = null;
    if (isQuiz) {
      quizResults = answerData.map((a) => {
        const sq = survey.questions.find(
          (sq) => sq.questionId === a.questionId
        );
        const correctOption = sq?.question.options.find((o) => o.isCorrect);
        return {
          questionId: a.questionId,
          questionText: sq?.question.text,
          yourAnswer: a.value,
          isCorrect: a.isCorrect,
          correctAnswer: correctOption?.text || null,
        };
      });
    }

    return NextResponse.json(
      { success: true, responseId: response.id, score, quizResults },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
