import { prisma } from "../prisma.js";

export async function deleteSurvey(surveyId: number): Promise<string> {
  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey) {
    return JSON.stringify({ error: `Enkät ${surveyId} hittades inte.` }, null, 2);
  }
  await prisma.survey.delete({ where: { id: surveyId } });
  return JSON.stringify({ deleted: true, id: surveyId, title: survey.title }, null, 2);
}
