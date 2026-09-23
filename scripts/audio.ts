import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Dataset, Lang } from "../lib/engine/types";
import datasetJson from "../data/dataset.json";
import { choicesFor } from "../lib/engine/bands";
import { answerText, pick } from "../lib/i18n/describe";
import { bandClip } from "../lib/easy/options";
import { leavesOf } from "../lib/engine/evaluate";
import { t } from "../lib/i18n/strings";

const ds = datasetJson as unknown as Dataset;
const LANGS: { lang: Lang; csv: string; column: string; texts: string }[] = [
  { lang: "ml", csv: "docs/malayalam-audio-clips.csv", column: "malayalam_text", texts: "data/audio-texts.json" },
  { lang: "en", csv: "docs/english-audio-clips.csv", column: "english_text", texts: "data/audio-texts.en.json" },
];

const asked = new Set(ds.schemes.flatMap((s) => leavesOf(s.rule).map((l) => l.fact)));

function rowsFor(lang: Lang): [string, string][] {
  const rows: [string, string][] = [];
  for (const f of ds.facts.filter((x) => asked.has(x.id))) {
    rows.push([`fact.${f.id}`, pick(f.question, lang)]);
    for (const o of f.options) rows.push([`option.${f.id}.${o.value}`, pick(o.label, lang)]);
    if (f.type === "number") {
      for (const c of choicesFor(f, ds.schemes)) {
        const key = bandClip(f.id, c);
        if (key) rows.push([key, answerText(f, c, lang)]);
      }
    }
  }
  rows.push(["option.yes", t("yes", lang)], ["option.no", t("no", lang)], ["option.unknown", t("dontKnow", lang)], ["option.declined", t("preferNot", lang)]);
  return rows;
}

const manifest: Record<string, string[]> = {};
for (const { lang, csv, column, texts } of LANGS) {
  const rows = rowsFor(lang);
  const dir = `public/audio/${lang}`;
  writeFileSync(csv, [`key,file,${column}`, ...rows.map(([k, v]) => `${k},${dir}/${k}.mp3,"${v.replace(/"/g, '""')}"`)].join("\n") + "\n");
  const recorded: Record<string, string> = existsSync(texts) ? JSON.parse(readFileSync(texts, "utf8")) : {};
  const want = new Map(rows);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".mp3")).map((f) => f.replace(/\.mp3$/, "")) : [];
  const stale = files.filter((k) => k in recorded && want.has(k) && recorded[k] !== want.get(k));
  const present = files.filter((k) => want.has(k) && !stale.includes(k));
  manifest[lang] = present.sort();
  const missing = rows.filter(([k]) => !present.includes(k)).length;
  console.log(`${lang}: ${rows.length} clips in ${csv}; ${present.length} usable, ${missing} missing${stale.length ? `, ${stale.length} stale (text changed): ${stale.join(", ")}` : ""}.`);
}
writeFileSync("data/audio-manifest.json", JSON.stringify(manifest, null, 2) + "\n");
