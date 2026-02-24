import { PrismaClient } from "@prisma/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../prisma/dev.db");

export const prisma = new PrismaClient({
  datasourceUrl: `file:${dbPath}`,
});
