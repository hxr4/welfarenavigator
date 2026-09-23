import { dataset } from "@/lib/data/load";

export async function GET() {
  const screenable = dataset.schemes.filter((s) => s.verification.eligibility === "verified").length;
  return Response.json({
    status: "ok",
    schemes: dataset.schemes.length,
    screenable,
    sources: dataset.sources.length,
    profiles: dataset.profiles.length,
    languages: ["en", "ml"],
    datasetBuilt: dataset.meta.generatedAt,
    examples: dataset.meta.includesExamples,
    forcedWithErrors: dataset.meta.forcedWithErrors ?? 0,
  });
}
