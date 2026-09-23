import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const CSV = "docs/malayalam-audio-clips.csv";
const DIR = "public/audio/ml";
const TEXTS = "data/audio-texts.json";
const MANIFEST = "data/audio-manifest.json";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function parseCsv(text) {
  return text
    .split("\n")
    .slice(1)
    .filter((l) => l.trim())
    .map((line) => {
      const a = line.indexOf(",");
      const b = line.indexOf(",", a + 1);
      let t = line.slice(b + 1).trim();
      if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1).replace(/""/g, '"');
      return { key: line.slice(0, a), text: t };
    });
}

export function spoken(text) {
  return text.replace(/₹\s?([\d,]+)(-ൽ)?/g, (_, n, suffix) => `${n} രൂപ${suffix ? "യിൽ" : ""}`).replace(/\s+/g, " ").trim();
}

function refreshManifest(rows, recorded) {
  const want = new Map(rows.map((r) => [r.key, r.text]));
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".mp3")).map((f) => f.replace(/\.mp3$/, "")) : [];
  const usable = files.filter((k) => want.has(k) && (!(k in recorded) || recorded[k] === want.get(k)));
  writeFileSync(MANIFEST, JSON.stringify({ ml: usable.sort() }, null, 2) + "\n");
  return usable.length;
}

async function main() {
  const rows = parseCsv(readFileSync(CSV, "utf8"));
  const recorded = existsSync(TEXTS) ? JSON.parse(readFileSync(TEXTS, "utf8")) : {};
  const only = value("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const todo = rows.filter((r) => {
    if (only && !only.includes(r.key)) return false;
    if (flag("force")) return true;
    const file = `${DIR}/${r.key}.mp3`;
    return !existsSync(file) || (r.key in recorded && recorded[r.key] !== r.text);
  });
  const chars = todo.reduce((n, r) => n + spoken(r.text).length, 0);
  console.log(`${rows.length} clips in the list, ${todo.length} to generate (${chars} characters).`);

  if (flag("dry-run")) {
    for (const r of todo) console.log(`${r.key}\t${spoken(r.text)}`);
    return;
  }

  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  const model = process.env.ELEVENLABS_MODEL || "eleven_v3";
  if (!key || !voice) {
    console.error("Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in your shell first. Nothing was sent.");
    process.exit(1);
  }
  mkdirSync(DIR, { recursive: true });

  let done = 0;
  for (const r of todo) {
    let attempt = 0;
    for (;;) {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text: spoken(r.text),
          model_id: model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (res.ok) {
        writeFileSync(`${DIR}/${r.key}.mp3`, Buffer.from(await res.arrayBuffer()));
        recorded[r.key] = r.text;
        writeFileSync(TEXTS, JSON.stringify(recorded, null, 2) + "\n");
        done++;
        console.log(`ok   ${r.key}`);
        break;
      }
      const body = (await res.text()).slice(0, 300);
      if (res.status === 401 || res.status === 403) {
        console.error(`Stopped: ElevenLabs refused the key (${res.status}). ${body}`);
        process.exit(1);
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        attempt++;
        await new Promise((ok) => setTimeout(ok, 2000 * attempt));
        continue;
      }
      console.error(`fail ${r.key}: ${res.status} ${body}`);
      break;
    }
  }
  const usable = refreshManifest(rows, recorded);
  console.log(`Generated ${done} of ${todo.length}. ${usable} of ${rows.length} clips are now in ${MANIFEST}.`);
  console.log("Listen to every clip before the demo; a native speaker should reject any that are mispronounced (delete the file and run again).");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
