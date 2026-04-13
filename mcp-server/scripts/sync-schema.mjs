#!/usr/bin/env node
// Kopierar huvudprojektets prisma/schema.prisma till mcp-server/prisma/schema.prisma
// så att MCP-serverns Prisma-klient alltid matchar huvudappens DB-struktur.
// Körs automatiskt via `prebuild` och `predev*`-skripten.

import { copyFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = resolve(__dirname, "../../prisma/schema.prisma");
const target = resolve(__dirname, "../prisma/schema.prisma");

if (!existsSync(source)) {
  console.error(`[sync-schema] Källfil saknas: ${source}`);
  process.exit(1);
}

const sourceContent = readFileSync(source, "utf8");
const targetContent = existsSync(target) ? readFileSync(target, "utf8") : "";

if (sourceContent === targetContent) {
  console.log("[sync-schema] Schemat är redan synkat.");
  process.exit(0);
}

copyFileSync(source, target);
console.log(`[sync-schema] Kopierade ${source} → ${target}`);
