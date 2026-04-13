import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { respondSchema } from "@/lib/validators";
import { handleApiError } from "@/lib/api-helpers";
import { getStudentSession } from "@/lib/student-session";

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

    // Build a questionId → SurveyQuestion lookup map (O(1) access)
    const questionMap = new Map(
      survey.questions.map((sq) => [sq.questionId, sq])
    );

    // Validate that every answer references a question in this survey AND
    // that there are no duplicate answers for the same question.
    const seen = new Set<number>();
    for (const a of answers) {
      if (!questionMap.has(a.questionId)) {
        return NextResponse.json(
          { error: "Vissa svar refererar till frågor som inte ingår i enkäten" },
          { status: 400 }
        );
      }
      if (seen.has(a.questionId)) {
        return NextResponse.json(
          { error: "Samma fråga besvaras flera gånger" },
          { status: 400 }
        );
      }
      seen.add(a.questionId);
    }

    // Require that every question in the survey is answered
    if (seen.size !== survey.questions.length) {
      return NextResponse.json(
        { error: "Alla frågor i enkäten måste besvaras" },
        { status: 400 }
      );
    }

    // Build answer data, computing isCorrect for multiple choice questions in all modes
    const isQuiz = survey.mode === "QUIZ";
    const answerData = answers.map((a) => {
      let isCorrect: boolean | null = null;
      const sq = questionMap.get(a.questionId);
      if (sq && sq.question.type === "MULTIPLE_CHOICE") {
        if (a.value === "__UNSURE__") {
          isCorrect = null; // Metacognitive "I'm not sure" - neither correct nor incorrect
        } else {
          const correctOption = sq.question.options.find((o) => o.isCorrect);
          isCorrect = correctOption ? a.value === correctOption.text : null;
        }
      }
      return { questionId: a.questionId, value: a.value, isCorrect };
    });

    const response = await prisma.response.create({
      data: {
        surveyId,
        studentId: session.studentId,
        answers: { create: answerData },
      },
    });

    // Delete any draft for this student+survey
    await prisma.draftResponse.deleteMany({
      where: { surveyId, studentId: session.studentId },
    });

    // Calculate score if there are any MC questions
    let score = null;
    const correct = answerData.filter((a) => a.isCorrect === true).length;
    const total = answerData.filter((a) => a.isCorrect !== null).length;
    if (total > 0) {
      score = {
        correct,
        total,
        percentage: Math.round((correct / total) * 100),
      };
    }

    // Fetch saved answers to get their IDs for the immediate-feedback payload
    const savedAnswers = await prisma.answer.findMany({
      where: { responseId: response.id },
      select: { id: true, questionId: true },
    });
    const answerIdMap = new Map(
      savedAnswers.map((a) => [a.questionId, a.id])
    );

    // Immediate feedback results (same shape for quiz and survey, client decides rendering)
    const results = answerData.map((a) => {
      const sq = questionMap.get(a.questionId);
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

    return NextResponse.json(
      {
        success: true,
        responseId: response.id,
        score,
        quizResults: isQuiz ? results : null,
        surveyResults: !isQuiz ? results : null,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
