import { z } from "zod";
import { dataset } from "@/lib/data/load";
import { nextQuestion } from "@/lib/engine/next-question";
import { parseAnswerMap } from "@/lib/engine/profile";
import { screenAll } from "@/lib/engine/screen";

const Body = z.object({ answers: z.record(z.string(), z.string()) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Expected {"answers": {"fact": "value"}}' }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  try {
    const answers = parseAnswerMap(dataset, parsed.data.answers);
    const results = screenAll(dataset, answers).map((r) => ({
      schemeId: r.scheme.id,
      name: r.scheme.name,
      status: r.status,
      conditions: r.leaves.map((l) => ({ id: l.leaf.id, fact: l.leaf.fact, result: l.result, source: l.leaf.source })),
      missingFacts: r.missingFacts,
      oneStep: r.oneStep ? { condition: r.oneStep.leaf.id, becomes: r.oneStep.becomes, howTo: r.oneStep.leaf.howTo } : undefined,
      documents: r.documents.map((d) => ({ id: d.doc.id, name: d.doc.name, conditional: d.conditional })),
      apply: r.scheme.apply,
    }));
    const q = nextQuestion(dataset, answers);
    return Response.json(
      { disclaimer: dataset.disclaimer.main, results, nextQuestion: q ? { fact: q.fact.id, question: q.fact.question } : null },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
