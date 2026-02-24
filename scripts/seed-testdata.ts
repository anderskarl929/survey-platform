import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomCode(length = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function main() {
  // --- Kurs 1: Matematik 7A ---
  const mat = await prisma.course.create({
    data: { name: "Matematik 7A", code: "MAT7A" },
  });

  const topicAlgebra = await prisma.topic.create({
    data: { name: "Algebra", courseId: mat.id },
  });
  const topicGeometri = await prisma.topic.create({
    data: { name: "Geometri", courseId: mat.id },
  });

  const q1 = await prisma.question.create({
    data: {
      text: "Vad är 3x + 5 = 20? Lös för x.",
      type: "MULTIPLE_CHOICE",
      topicId: topicAlgebra.id,
      options: {
        create: [
          { text: "x = 3", isCorrect: false },
          { text: "x = 5", isCorrect: true },
          { text: "x = 7", isCorrect: false },
          { text: "x = 15", isCorrect: false },
        ],
      },
    },
  });

  const q2 = await prisma.question.create({
    data: {
      text: "Förenkla uttrycket: 2(a + 3) - 4",
      type: "MULTIPLE_CHOICE",
      topicId: topicAlgebra.id,
      options: {
        create: [
          { text: "2a + 2", isCorrect: true },
          { text: "2a + 6", isCorrect: false },
          { text: "2a - 1", isCorrect: false },
          { text: "a + 2", isCorrect: false },
        ],
      },
    },
  });

  const q3 = await prisma.question.create({
    data: {
      text: "Hur beräknas arean av en triangel?",
      type: "MULTIPLE_CHOICE",
      topicId: topicGeometri.id,
      options: {
        create: [
          { text: "bas × höjd", isCorrect: false },
          { text: "(bas × höjd) / 2", isCorrect: true },
          { text: "bas + höjd", isCorrect: false },
          { text: "2 × bas × höjd", isCorrect: false },
        ],
      },
    },
  });

  const q4 = await prisma.question.create({
    data: {
      text: "Vad tyckte du var svårast i kapitlet om algebra?",
      type: "FREE_TEXT",
      topicId: topicAlgebra.id,
    },
  });

  const q5 = await prisma.question.create({
    data: {
      text: "Hur många grader har vinklarna i en triangel sammanlagt?",
      type: "MULTIPLE_CHOICE",
      topicId: topicGeometri.id,
      options: {
        create: [
          { text: "90°", isCorrect: false },
          { text: "180°", isCorrect: true },
          { text: "270°", isCorrect: false },
          { text: "360°", isCorrect: false },
        ],
      },
    },
  });

  // Skapa elever
  const students = [];
  for (let i = 1; i <= 8; i++) {
    students.push(
      await prisma.student.create({
        data: { number: i, courseId: mat.id },
      })
    );
  }

  // Enkät 1: Quiz - Algebra
  const survey1 = await prisma.survey.create({
    data: {
      title: "Quiz: Algebra kapitel 3",
      description: "Testa dina kunskaper i algebra",
      shareCode: randomCode(6),
      mode: "QUIZ",
      courseId: mat.id,
      questions: {
        create: [
          { questionId: q1.id, order: 0 },
          { questionId: q2.id, order: 1 },
        ],
      },
    },
  });

  // Enkät 2: Utvärdering - Geometri
  const survey2 = await prisma.survey.create({
    data: {
      title: "Utvärdering: Geometri",
      description: "Berätta hur du upplevde geometri-avsnittet",
      shareCode: randomCode(6),
      mode: "SURVEY",
      courseId: mat.id,
      questions: {
        create: [
          { questionId: q3.id, order: 0 },
          { questionId: q5.id, order: 1 },
          { questionId: q4.id, order: 2 },
        ],
      },
    },
  });

  // Hämta options för att kunna ange svar
  const q1Opts = await prisma.questionOption.findMany({ where: { questionId: q1.id } });
  const q2Opts = await prisma.questionOption.findMany({ where: { questionId: q2.id } });
  const q3Opts = await prisma.questionOption.findMany({ where: { questionId: q3.id } });
  const q5Opts = await prisma.questionOption.findMany({ where: { questionId: q5.id } });

  // Svar på Quiz (6 elever svarar)
  const quizAnswers = [
    { student: 0, a1: 1, a2: 0 }, // rätt, rätt
    { student: 1, a1: 1, a2: 0 }, // rätt, rätt
    { student: 2, a1: 0, a2: 0 }, // fel, rätt
    { student: 3, a1: 1, a2: 1 }, // rätt, fel
    { student: 4, a1: 1, a2: 0 }, // rätt, rätt
    { student: 5, a1: 2, a2: 2 }, // fel, fel
  ];

  for (const qa of quizAnswers) {
    const resp = await prisma.response.create({
      data: { surveyId: survey1.id, studentId: students[qa.student].id },
    });
    await prisma.answer.create({
      data: {
        responseId: resp.id,
        questionId: q1.id,
        value: q1Opts[qa.a1].text,
        isCorrect: q1Opts[qa.a1].isCorrect,
      },
    });
    await prisma.answer.create({
      data: {
        responseId: resp.id,
        questionId: q2.id,
        value: q2Opts[qa.a2].text,
        isCorrect: q2Opts[qa.a2].isCorrect,
      },
    });
  }

  // Svar på Utvärdering (5 elever svarar)
  const freeTextResponses = [
    "Ekvationer med x på båda sidor var svårast.",
    "Jag tyckte det var lätt, men parenteser var lite förvirrande.",
    "Svårt att veta när man ska addera eller subtrahera.",
    "Allt var okej, men textuppgifterna var knepiga.",
    "Jag behöver öva mer på förenkling av uttryck.",
  ];

  for (let i = 0; i < 5; i++) {
    const resp = await prisma.response.create({
      data: { surveyId: survey2.id, studentId: students[i].id },
    });
    // MC-fråga om triangelarea
    const q3pick = i < 3 ? 1 : 0; // 3 rätt, 2 fel
    await prisma.answer.create({
      data: {
        responseId: resp.id,
        questionId: q3.id,
        value: q3Opts[q3pick].text,
        isCorrect: q3Opts[q3pick].isCorrect,
      },
    });
    // MC-fråga om vinkelsumma
    const q5pick = i < 4 ? 1 : 3; // 4 rätt, 1 fel
    await prisma.answer.create({
      data: {
        responseId: resp.id,
        questionId: q5.id,
        value: q5Opts[q5pick].text,
        isCorrect: q5Opts[q5pick].isCorrect,
      },
    });
    // Fri text
    await prisma.answer.create({
      data: {
        responseId: resp.id,
        questionId: q4.id,
        value: freeTextResponses[i],
      },
    });
  }

  // --- Kurs 2: Svenska 8B ---
  const sve = await prisma.course.create({
    data: { name: "Svenska 8B", code: "SVE8B" },
  });

  const topicLas = await prisma.topic.create({
    data: { name: "Läsförståelse", courseId: sve.id },
  });

  const sq1 = await prisma.question.create({
    data: {
      text: "Vad är en metafor?",
      type: "MULTIPLE_CHOICE",
      topicId: topicLas.id,
      options: {
        create: [
          { text: "Ett bildligt uttryck som jämför utan 'som'", isCorrect: true },
          { text: "En typ av rim", isCorrect: false },
          { text: "Ett långt ord", isCorrect: false },
        ],
      },
    },
  });

  const sq2 = await prisma.question.create({
    data: {
      text: "Hur upplevde du bokens handling?",
      type: "FREE_TEXT",
      topicId: topicLas.id,
    },
  });

  // 4 elever i svenska
  const sveStudents = [];
  for (let i = 1; i <= 4; i++) {
    sveStudents.push(
      await prisma.student.create({
        data: { number: i, courseId: sve.id },
      })
    );
  }

  const survey3 = await prisma.survey.create({
    data: {
      title: "Läslogg: November",
      description: "Reflektion kring månadens bok",
      shareCode: randomCode(6),
      mode: "SURVEY",
      courseId: sve.id,
      questions: {
        create: [
          { questionId: sq1.id, order: 0 },
          { questionId: sq2.id, order: 1 },
        ],
      },
    },
  });

  const sq1Opts = await prisma.questionOption.findMany({ where: { questionId: sq1.id } });
  const bookResponses = [
    "Boken var spännande, särskilt slutet.",
    "Jag tyckte den var lite tråkig i mitten men bra avslutning.",
    "Mycket bra! Jag kunde relatera till huvudkaraktären.",
  ];

  for (let i = 0; i < 3; i++) {
    const resp = await prisma.response.create({
      data: { surveyId: survey3.id, studentId: sveStudents[i].id },
    });
    await prisma.answer.create({
      data: {
        responseId: resp.id,
        questionId: sq1.id,
        value: sq1Opts[i === 2 ? 1 : 0].text,
        isCorrect: sq1Opts[i === 2 ? 1 : 0].isCorrect,
      },
    });
    await prisma.answer.create({
      data: {
        responseId: resp.id,
        questionId: sq2.id,
        value: bookResponses[i],
      },
    });
  }

  console.log("Testdata skapad!");
  console.log(`  Kurs: ${mat.name} (kod: ${mat.code}) — 5 frågor, 2 enkäter, 8 elever`);
  console.log(`    - "${survey1.title}" (Quiz) — 6 svar`);
  console.log(`    - "${survey2.title}" (Enkät) — 5 svar`);
  console.log(`  Kurs: ${sve.name} (kod: ${sve.code}) — 2 frågor, 1 enkät, 4 elever`);
  console.log(`    - "${survey3.title}" (Enkät) — 3 svar`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
