-- Lägg till räknare för lockMode-avvikelser (tabbyten, lämnad helskärm)
-- så läraren faktiskt kan se dem i resultatsidan.

ALTER TABLE "Response" ADD COLUMN "lockModeViolations" INTEGER NOT NULL DEFAULT 0;
