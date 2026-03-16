import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./prisma.js";

const PORT = process.env.MCP_HTTP_PORT || 3002;
const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "survey-mcp-server" });
});

// Get feedback for a specific answer
app.get("/feedback/:answerId", async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    if (isNaN(answerId)) {
      return res.status(400).json({ error: "Ogiltigt answer ID" });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      select: { feedback: true },
    });

    if (!answer) {
      return res.status(404).json({ error: "Svar hittades inte" });
    }

    res.json({ feedback: answer.feedback });
  } catch (error) {
    console.error("Feedback fetch error:", error);
    res.status(500).json({ error: "Kunde inte hämta feedback" });
  }
});

// Save feedback for a specific answer (called by external tools)
app.post("/feedback/:answerId", async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    if (isNaN(answerId)) {
      return res.status(400).json({ error: "Ogiltigt answer ID" });
    }

    const { feedback } = req.body;
    if (!feedback || typeof feedback !== "string") {
      return res.status(400).json({ error: "feedback (string) krävs" });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
    });

    if (!answer) {
      return res.status(404).json({ error: "Svar hittades inte" });
    }

    await prisma.answer.update({
      where: { id: answerId },
      data: { feedback },
    });

    res.json({ success: true, feedback });
  } catch (error) {
    console.error("Feedback save error:", error);
    res.status(500).json({ error: "Kunde inte spara feedback" });
  }
});

// List free-text answers without feedback for a survey
app.get("/feedback/pending/:surveyId", async (req, res) => {
  try {
    const surveyId = Number(req.params.surveyId);
    if (isNaN(surveyId)) {
      return res.status(400).json({ error: "Ogiltigt survey ID" });
    }

    const answers = await prisma.answer.findMany({
      where: {
        response: { surveyId },
        question: { type: "FREE_TEXT" },
        feedback: null,
      },
      include: {
        question: { include: { topic: true } },
        response: { include: { student: true } },
      },
    });

    res.json({
      count: answers.length,
      answers: answers.map((a) => ({
        answerId: a.id,
        studentNumber: a.response.student.number,
        topic: a.question.topic.name,
        question: a.question.text,
        answer: a.value,
      })),
    });
  } catch (error) {
    console.error("Pending feedback error:", error);
    res.status(500).json({ error: "Kunde inte hämta svar" });
  }
});

app.listen(PORT, () => {
  console.log(`MCP HTTP server running on http://localhost:${PORT}`);
  console.log(`No API keys needed — feedback is generated via Claude Desktop`);
});
