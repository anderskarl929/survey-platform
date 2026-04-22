import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Step 1: Check for new responses today
  const newResponsesCheck = await sql`
    SELECT COUNT(*) as count FROM "Response"
    WHERE "createdAt" >= ${todayISO}
  `;

  const count = parseInt(newResponsesCheck[0].count as string, 10);

  if (count === 0) {
    console.log(JSON.stringify({ newResponses: false }));
    process.exit(0);
  }

  // Step 2: Get surveys with new responses today
  const surveysWithNewResponses = await sql`
    SELECT DISTINCT s.id as "surveyId", s.title as "surveyTitle", s.mode,
           c.id as "courseId", c.name as "courseName"
    FROM "Response" r
    JOIN "Survey" s ON r."surveyId" = s.id
    JOIN "Course" c ON s."courseId" = c.id
    WHERE r."createdAt" >= ${todayISO}
    ORDER BY s.id
  `;

  const surveyIds = surveysWithNewResponses.map((s: any) => s.surveyId);

  // Step 3: Fetch all responses (not just today) for those surveys for full context
  const allResponses = await sql`
    SELECT
      r.id as "responseId",
      r."createdAt",
      r."surveyId",
      st.number as "studentNumber",
      s.title as "surveyTitle",
      s.mode as "surveyMode",
      c.name as "courseName"
    FROM "Response" r
    JOIN "Student" st ON r."studentId" = st.id
    JOIN "Survey" s ON r."surveyId" = s.id
    JOIN "Course" c ON s."courseId" = c.id
    WHERE r."surveyId" = ANY(${surveyIds})
    ORDER BY r."surveyId", r."createdAt"
  `;

  // Step 4: Fetch all answers with questions for those surveys
  const allAnswers = await sql`
    SELECT
      a.id as "answerId",
      a."responseId",
      a.value,
      q.id as "questionId",
      q.text as "questionText",
      q.type as "questionType",
      q."correctAnswer",
      q."order"
    FROM "Answer" a
    JOIN "Question" q ON a."questionId" = q.id
    JOIN "Response" r ON a."responseId" = r.id
    WHERE r."surveyId" = ANY(${surveyIds})
    ORDER BY q."order", a."responseId"
  `;

  // Step 5: Fetch all questions for those surveys
  const allQuestions = await sql`
    SELECT
      q.id as "questionId",
      q.text as "questionText",
      q.type as "questionType",
      q."correctAnswer",
      q."order",
      q."surveyId"
    FROM "Question" q
    WHERE q."surveyId" = ANY(${surveyIds})
    ORDER BY q."surveyId", q."order"
  `;

  const result = {
    newResponses: true,
    totalNewToday: count,
    date: today.toISOString().split("T")[0],
    surveys: surveysWithNewResponses,
    allResponses,
    allAnswers,
    allQuestions,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
