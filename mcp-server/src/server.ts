import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { importQuestions } from "./tools/import-questions.js";
import { createSurvey } from "./tools/create-survey.js";
import { getResults } from "./tools/get-results.js";
import { summarizeResults } from "./tools/summarize-results.js";
import { getStudentProgress } from "./tools/get-student-progress.js";
import { listTopics } from "./resources/topics.js";
import { getQuestionsByTopic } from "./resources/questions.js";
import { listCourses } from "./resources/courses.js";

const server = new McpServer({
  name: "survey-platform",
  version: "1.0.0",
});

// Tools

server.tool(
  "import_questions",
  "Importera frågor till en kurs frågebank från CSV-innehåll. CSV-format: topic,type,text,option1,option2,...",
  {
    course_id: z.number().int().positive().describe("Kursens ID"),
    csv_content: z.string().min(1).describe("CSV-innehåll med frågor"),
  },
  async ({ course_id, csv_content }) => {
    try {
      const result = await importQuestions(course_id, csv_content);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fel vid import: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "create_survey",
  "Skapa en ny enkät i en kurs från fråge-ID:n i frågebanken",
  {
    course_id: z.number().int().positive().describe("Kursens ID"),
    title: z.string().min(1).describe("Enkätens titel"),
    question_ids: z
      .array(z.number().int().positive())
      .min(1)
      .describe("Lista med fråge-ID:n att inkludera"),
    description: z.string().optional().describe("Valfri beskrivning"),
  },
  async ({ course_id, title, question_ids, description }) => {
    try {
      const result = await createSurvey(
        course_id,
        title,
        question_ids,
        description
      );
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fel vid skapande av enkät: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_results",
  "Hämta detaljerade resultat för en enkät",
  { survey_id: z.number().int().positive().describe("Enkätens ID") },
  async ({ survey_id }) => {
    try {
      const result = await getResults(survey_id);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fel vid hämtning av resultat: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "summarize_results",
  "Hämta en sammanfattning av enkätresultat formaterad för AI-analys. Inkluderar procentfördelning för flerval och alla fritextsvar.",
  { survey_id: z.number().int().positive().describe("Enkätens ID") },
  async ({ survey_id }) => {
    try {
      const result = await summarizeResults(survey_id);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fel vid sammanfattning: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_student_progress",
  "Hämta alla svar från en specifik elev över alla enkäter i en kurs. Användbart för att följa en elevs utveckling över tid.",
  {
    course_id: z.number().int().positive().describe("Kursens ID"),
    student_number: z.number().int().positive().describe("Elevens nummer"),
  },
  async ({ course_id, student_number }) => {
    try {
      const result = await getStudentProgress(course_id, student_number);
      return { content: [{ type: "text" as const, text: result }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Fel vid hämtning av elevprogression: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Resources

server.resource(
  "courses",
  "survey://courses",
  { description: "Lista alla kurser" },
  async () => {
    try {
      const result = await listCourses();
      return {
        contents: [
          {
            uri: "survey://courses",
            text: result,
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: "survey://courses",
            text: JSON.stringify({
              error: `Fel: ${(error as Error).message}`,
            }),
            mimeType: "application/json",
          },
        ],
      };
    }
  }
);

server.resource(
  "topics",
  "survey://courses/{courseId}/topics",
  { description: "Lista alla ämnen i en kurs med antal frågor" },
  async (uri) => {
    try {
      const match = uri.href.match(/courses\/(\d+)\/topics/);
      if (!match) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: "Ogiltigt kurs-ID i URI" }),
              mimeType: "application/json",
            },
          ],
        };
      }
      const courseId = Number(match[1]);
      const result = await listTopics(courseId);
      return {
        contents: [
          { uri: uri.href, text: result, mimeType: "application/json" },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({
              error: `Fel: ${(error as Error).message}`,
            }),
            mimeType: "application/json",
          },
        ],
      };
    }
  }
);

server.resource(
  "questions-template",
  "survey://topics/{topicId}/questions",
  { description: "Hämta alla frågor inom ett visst ämne" },
  async (uri) => {
    try {
      const match = uri.href.match(/topics\/(\d+)\/questions/);
      if (!match) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: "Ogiltigt ämnes-ID i URI" }),
              mimeType: "application/json",
            },
          ],
        };
      }
      const topicId = Number(match[1]);
      const result = await getQuestionsByTopic(topicId);
      return {
        contents: [
          { uri: uri.href, text: result, mimeType: "application/json" },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({
              error: `Fel: ${(error as Error).message}`,
            }),
            mimeType: "application/json",
          },
        ],
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Survey MCP server running on stdio");
}

main().catch(console.error);
