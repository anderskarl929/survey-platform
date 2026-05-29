import Papa from "../mcp-server/node_modules/papaparse/papaparse.js";
import { readFileSync } from "node:fs";

const files = ["lektion-1.csv", "lektion-2.csv", "momentquiz.csv"];
let problems = 0;

for (const f of files) {
  const csv = readFileSync(new URL(f, import.meta.url), "utf8");
  const { data, errors } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  console.log(`\n=== ${f} ===`);
  if (errors.length) {
    console.log("  PARSE-FEL:", JSON.stringify(errors));
    problems += errors.length;
  }
  data.forEach((row, i) => {
    const type = (row.type || "").trim().toUpperCase();
    const text = (row.text || "").trim();
    if (!text) { console.log(`  rad ${i + 1}: SAKNAR text`); problems++; return; }
    if (type === "MULTIPLE_CHOICE") {
      const opts = [row.option1, row.option2, row.option3, row.option4].map((o) => (o || "").trim()).filter(Boolean);
      const correct = (row.correctAnswer || "").trim();
      const ok = opts.includes(correct);
      console.log(`  rad ${i + 1}: MC, ${opts.length} alt, correct=${ok ? "MATCHAR" : "!!! MATCHAR INTE !!!"}`);
      if (!ok) problems++;
    } else {
      console.log(`  rad ${i + 1}: FREE_TEXT ok`);
    }
  });
}
console.log(problems === 0 ? "\nALLT OK - inga problem." : `\n${problems} PROBLEM hittades.`);
process.exit(problems === 0 ? 0 : 1);
