import { z } from "zod";
import { dataset } from "@/lib/data/load";
import { buildPrompt, checkGrounding, gatherEvidence, INTENTS } from "@/lib/assist/evidence";
import { assistConfigured, assistModel, complete, ModelError } from "@/lib/assist/model";

const headers = { "cache-control": "no-store" };

const Body = z
  .object({
    schemeId: z.string().max(32),
    intent: z.enum(INTENTS),
    lang: z.enum(["en", "ml"]),
  })
  .strict();

export async function GET() {
  return Response.json({ available: assistConfigured(), model: assistConfigured() ? assistModel() : null }, { headers });
}

export async function POST(request: Request) {
  if (!assistConfigured()) return Response.json({ ok: false, reason: "not_configured" }, { status: 503, headers });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad_request" }, { status: 400, headers });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, reason: "bad_request" }, { status: 400, headers });
  const { schemeId, intent, lang } = parsed.data;
  const scheme = dataset.schemes.find((s) => s.id === schemeId);
  if (!scheme) return Response.json({ ok: false, reason: "unknown_scheme" }, { status: 404, headers });
  const passages = gatherEvidence(dataset, schemeId, intent, lang);
  if (passages.length === 0) return Response.json({ ok: false, reason: "no_sources" }, { headers });

  const { system, user } = buildPrompt(scheme, intent, lang, passages);
  let text: string;
  try {
    text = await complete(system, user);
  } catch (e) {
    const reason = e instanceof ModelError ? e.message : "model_error";
    return Response.json({ ok: false, reason }, { status: 502, headers });
  }
  if (text.includes("NOT_IN_SOURCES")) return Response.json({ ok: false, reason: "not_in_sources" }, { headers });
  const grounding = checkGrounding(text, passages);
  if (!grounding.ok) return Response.json({ ok: false, reason: "ungrounded", checks: grounding.reasons }, { headers });
  return Response.json({ ok: true, text, model: assistModel(), passages: passages.length }, { headers });
}
