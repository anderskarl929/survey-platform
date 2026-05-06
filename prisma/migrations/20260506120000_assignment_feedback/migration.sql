-- Lärar-postad fritextfeedback på externa uppgifter (uppsatser, presentationer m.m.)
-- Eleven ser bara sin egen via /student/feedback. readAt sätts när eleven öppnar.

CREATE TABLE "AssignmentFeedback" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssignmentFeedback_studentId_createdAt_idx" ON "AssignmentFeedback"("studentId", "createdAt");

ALTER TABLE "AssignmentFeedback" ADD CONSTRAINT "AssignmentFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
