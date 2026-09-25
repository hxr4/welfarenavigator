import { asciiDigits } from "../assist/evidence";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string): string {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const stripped = main
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|nav|header|footer|form|select)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/td|\/th|\/section|\/article|\/blockquote)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return normalizeText(decodeEntities(stripped));
}

export function normalizeText(s: string): string {
  return asciiDigits(s.normalize("NFC"))
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function lineChanges(before: string, after: string, max = 40): { added: string[]; removed: string[] } {
  const a = new Set(before.split("\n"));
  const b = new Set(after.split("\n"));
  return {
    added: [...b].filter((l) => !a.has(l)).slice(0, max),
    removed: [...a].filter((l) => !b.has(l)).slice(0, max),
  };
}
