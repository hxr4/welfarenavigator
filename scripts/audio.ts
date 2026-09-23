import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Dataset } from "../lib/engine/types";
import datasetJson from "../data/dataset.json";
import { choicesFor } from "../lib/engine/bands";
import { answerText } from "../lib/i18n/describe";
import { bandClip } from "../lib/easy/options";
import { t } from "../lib/i18n/strings";

const ds = datasetJson as unknown as Dataset;
const rows: [string, string][] = [];
for (const f of ds.facts) {
  rows.push([`fact.${f.id}`, f.question.ml]);
  for (const o of f.options) rows.push([`option.${f.id}.${o.value}`, o.label.ml]);
  if (f.type === "number") {
    for (const c of choicesFor(f, ds.schemes)) {
      const key = bandClip(f.id, c);
      if (key) rows.push([key, answerText(f, c, "ml")]);
    }
  }
}
rows.push(["option.yes", t("yes", "ml")], ["option.no", t("no", "ml")], ["option.unknown", t("dontKnow", "ml")], ["option.declined", t("preferNot", "ml")]);
const csv = ["key,file,malayalam_text", ...rows.map(([k, v]) => `${k},public/audio/ml/${k}.mp3,"${v.replace(/"/g, '""')}"`)].join("\n");
writeFileSync("docs/malayalam-audio-clips.csv", csv + "\n");

const dir = "public/audio/ml";
const textsFile = "data/audio-texts.json";
const recorded: Record<string, string> = existsSync(textsFile) ? JSON.parse(readFileSync(textsFile, "utf8")) : {};
const want = new Map(rows);
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".mp3")).map((f) => f.replace(/\.mp3$/, "")) : [];
const stale = files.filter((k) => k in recorded && want.has(k) && recorded[k] !== want.get(k));
const present = files.filter((k) => want.has(k) && !stale.includes(k));
writeFileSync("data/audio-manifest.json", JSON.stringify({ ml: present.sort() }, null, 2) + "\n");
const missing = rows.filter(([k]) => !present.includes(k)).length;
console.log(`${rows.length} Malayalam clips listed in docs/malayalam-audio-clips.csv; ${present.length} usable, ${missing} missing${stale.length ? `, ${stale.length} stale (text changed): ${stale.join(", ")}` : ""}.`);
