import { writeFileSync } from "node:fs";
import { fixture } from "../tests/fixture";

const ds = fixture();
ds.meta = { generatedAt: new Date().toISOString(), includesExamples: true, version: "fixture" };
writeFileSync("data/dataset.json", JSON.stringify(ds, null, 2));
console.log("Wrote data/dataset.json from the fictional test fixture (examples only)");
