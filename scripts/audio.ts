import { existsSync, readdirSync, writeFileSync } from "node:fs";
import type { Dataset } from "../lib/engine/types";
import datasetJson from "../data/dataset.json";

const ds = datasetJson as unknown as Dataset;
const rows: [string, string][] = [];
for (const f of ds.facts) {
  rows.push([`fact.${f.id}`, f.question.ml]);
  for (const o of f.options) rows.push([`option.${f.id}.${o.value}`, o.label.ml]);
}
rows.push(["option.yes", "അതെ"], ["option.no", "അല്ല"], ["option.unknown", "അറിയില്ല"]);
const csv = ["key,file,malayalam_text", ...rows.map(([k, v]) => `${k},public/audio/ml/${k}.mp3,"${v.replace(/"/g, '""')}"`)].join("\n");
writeFileSync("docs/malayalam-audio-clips.csv", csv + "\n");

const dir = "public/audio/ml";
const present = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".mp3")).map((f) => f.replace(/\.mp3$/, "")) : [];
writeFileSync("data/audio-manifest.json", JSON.stringify({ ml: present.sort() }, null, 2) + "\n");
const missing = rows.filter(([k]) => !present.includes(k)).length;
console.log(`${rows.length} Malayalam clips listed in docs/malayalam-audio-clips.csv; ${present.length} recorded, ${missing} missing.`);
