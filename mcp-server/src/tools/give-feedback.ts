import { prisma } from "../prisma.js";

export async function giveFeedback(
  surveyId: number,
  studentNumber?: number
): Promise<string> {
  // Find the survey
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { course: true },
  });

  if (!survey) {
    throw new Error(`Enkät med ID ${surveyId} hittades inte`);
  }

  // Build query for answers
  const whereClause: Record<string, unknown> = {
    response: { surveyId },
    question: { type: "FREE_TEXT" },
    feedback: null, // Only answers without feedback
  };

  if (studentNumber) {
    whereClause.response = {
      ...whereClause.response as object,
      student: { number: studentNumber, courseId: survey.courseId },
    };
  }

  const answers = await prisma.answer.findMany({
    where: whereClause,
    include: {
      question: { include: { topic: true } },
      response: { include: { student: true } },
    },
  });

  if (answers.length === 0) {
    return studentNumber
      ? `Inga fritextsvar utan feedback hittades för elev ${studentNumber} i enkät "${survey.title}".`
      : `Inga fritextsvar utan feedback hittades i enkät "${survey.title}".`;
  }

  const results: string[] = [];

  for (const answer of answers) {
    const feedbackText = await generateFeedback(
      answer.question.topic.name,
      answer.question.text,
      answer.value
    );

    await prisma.answer.update({
      where: { id: answer.id },
      data: { feedback: feedbackText },
    });

    results.push(
      `Elev ${answer.response.student.number} — "${answer.question.text}":\n` +
      `  Svar: ${answer.value}\n` +
      `  Feedback: ${feedbackText}`
    );
  }

  return `Feedback genererad för ${results.length} fritextsvar i "${survey.title}":\n\n${results.join("\n\n")}`;
}

async function generateFeedback(
  topicName: string,
  questionText: string,
  studentAnswer: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY saknas i miljövariabler. Lägg till den i mcp-server/.env"
    );
  }

  const systemPrompt = `Du är en hjälpsam och uppmuntrande lärare som ger feedback på elevsvar.
Ge kort, konstruktiv feedback på svenska (max 3-4 meningar).
- Bekräfta det som är bra i svaret
- Peka på eventuella brister eller missförstånd
- Ge ett konkret tips på hur svaret kan förbättras
- Var uppmuntrande men ärlig
- Anpassa nivån — det här är en elev, inte en expert`;

  const userPrompt = `Ämne: ${topicName}
Fråga: ${questionText}
Elevens svar: ${studentAnswer}

Ge feedback på elevens svar.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Claude API-fel (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "Kunde inte generera feedback.";
}
