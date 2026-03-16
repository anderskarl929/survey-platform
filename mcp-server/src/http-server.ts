import "dotenv/config";
import express from "express";
import cors from "cors";
import { giveFeedback } from "./tools/give-feedback.js";
import { prisma } from "./prisma.js";

const PORT = process.env.MCP_HTTP_PORT || 3002;
const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "survey-mcp-server" });
});

// Generate feedback for free-text answers in a survey
app.post("/feedback/generate", async (req, res) => {
  try {
    const { survey_id, student_number } = req.body;

    if (!survey_id || typeof survey_id !== "number") {
      return res.status(400).json({ error: "survey_id (number) krävs" });
    }

    const result = await giveFeedback(survey_id, student_number);
    res.json({ success: true, message: result });
  } catch (error) {
    console.error("Feedback generation error:", error);
    res.status(500).json({
      error: (error as Error).message || "Kunde inte generera feedback",
    });
  }
});

// Get feedback for a specific answer (read-only, for the webapp)
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

// Generate feedback for a single answer by ID
app.post("/feedback/:answerId", async (req, res) => {
  try {
    const answerId = Number(req.params.answerId);
    if (isNaN(answerId)) {
      return res.status(400).json({ error: "Ogiltigt answer ID" });
    }

    const answer = await prisma.answer.findUnique({
      where: { id: answerId },
      include: {
        question: { include: { topic: true } },
      },
    });

    if (!answer) {
      return res.status(404).json({ error: "Svar hittades inte" });
    }

    if (answer.question.type !== "FREE_TEXT") {
      return res
        .status(400)
        .json({ error: "Feedback är bara tillgängligt för fritextsvar" });
    }

    // Return existing feedback if already generated
    if (answer.feedback) {
      return res.json({ feedback: answer.feedback });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY saknas" });
    }

    const systemPrompt = `Du är en hjälpsam och uppmuntrande lärare som ger feedback på elevsvar.
Ge kort, konstruktiv feedback på svenska (max 3-4 meningar).
- Bekräfta det som är bra i svaret
- Peka på eventuella brister eller missförstånd
- Ge ett konkret tips på hur svaret kan förbättras
- Var uppmuntrande men ärlig
- Anpassa nivån — det här är en elev, inte en expert`;

    const userPrompt = `Ämne: ${answer.question.topic.name}
Fråga: ${answer.question.text}
Elevens svar: ${answer.value}

Ge feedback på elevens svar.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
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

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errBody);
      return res.status(502).json({ error: "Claude API-fel" });
    }

    const claudeData = await claudeRes.json();
    const feedback =
      claudeData.content?.[0]?.text || "Kunde inte generera feedback.";

    // Save to database
    await prisma.answer.update({
      where: { id: answerId },
      data: { feedback },
    });

    res.json({ feedback });
  } catch (error) {
    console.error("Feedback generation error:", error);
    res.status(500).json({ error: "Kunde inte generera feedback" });
  }
});

app.listen(PORT, () => {
  console.log(`MCP HTTP server running on http://localhost:${PORT}`);
});
