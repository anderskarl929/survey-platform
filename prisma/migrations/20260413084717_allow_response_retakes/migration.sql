-- Allow students to retake a survey: drop unique constraint on (surveyId, studentId)
-- and replace with a regular index for query performance.

-- DropIndex
DROP INDEX "Response_surveyId_studentId_key";

-- CreateIndex
CREATE INDEX "Response_surveyId_studentId_idx" ON "Response"("surveyId", "studentId");
