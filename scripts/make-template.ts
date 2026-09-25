import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import { DISCLAIMER_DRAFT, SHEETS } from "../lib/data/sheets";

const out = process.argv[2] ?? "dataset/welfare-dataset.xlsx";
if (existsSync(out) && !process.argv.includes("--force")) {
  console.error(`${out} already exists. Pass --force to overwrite.`);
  process.exit(1);
}

const README = [
  "Welfare Navigator dataset",
  "",
  "Rule 1. Every condition, document and office must come from an official source listed in the sources sheet.",
  "Rule 2. Tier 1 = Act, Rules, Gazette, Government Order, official scheme guideline. Tier 2 = official department or welfare board page. Tier 3 = reports: use to find schemes, never as a rule source.",
  "Rule 3. Never guess a missing condition. If a source does not state it, mark the scheme partial and write the gap in notes.",
  "Rule 4. Copy quotes exactly. Save a copy of every source in the sources/ folder and put the file name in local_file.",
  "Rule 5. A newer Tier 1 source beats an older Tier 2 page. Record conflicts in notes.",
  "Rule 6. Strip tracking parts from URLs (anything after ?utm_).",
  "",
  "Order of work: sources -> schemes -> facts and options -> conditions -> documents and scheme_documents -> location_types, locations, scheme_apply -> terminology -> profiles.",
  "Conditions: rows with the same scheme_id and group are alternatives (any one is enough). Different groups must all be met.",
  "Profiles: write them from the source text, not from the conditions sheet. Include incomplete, boundary and mixed households.",
  "Rows whose first cell starts with EXAMPLE are ignored by the app. Delete or overwrite them.",
  "",
  "After editing, the developer runs: npm run data   (converts this workbook and reports every error with sheet and row).",
  "",
  "Column guide",
];

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Welfare Navigator";
  const readme = wb.addWorksheet("README");
  readme.getColumn(1).width = 26;
  readme.getColumn(2).width = 22;
  readme.getColumn(3).width = 100;
  for (const line of README) readme.addRow([line]);
  readme.getRow(1).font = { bold: true, size: 14 };
  for (const s of SHEETS) {
    const r = readme.addRow([s.name, "", s.purpose]);
    r.font = { bold: true };
    for (const c of s.columns) {
      readme.addRow(["", c.key + (c.required ? " *" : ""), c.help + (c.allowed ? `  [${c.allowed.filter(Boolean).join(", ")}]` : "")]);
    }
  }
  readme.getColumn(3).alignment = { wrapText: true, vertical: "top" };

  for (const s of SHEETS) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.columns.map((c) => ({ header: c.key, key: c.key, width: c.width ?? 16 }));
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6E6" } };
    s.columns.forEach((c, i) => {
      header.getCell(i + 1).note = (c.required ? "Required. " : "") + c.help;
    });
    for (const ex of s.examples) ws.addRow(ex);
    if (s.name === "disclaimer") {
      for (const [key, v] of Object.entries(DISCLAIMER_DRAFT)) ws.addRow({ key, en: v.en, ml: v.ml });
    }
    s.columns.forEach((c, i) => {
      if (!c.allowed) return;
      const letter = ws.getColumn(i + 1).letter;
      for (let row = 2; row <= 400; row++) {
        ws.getCell(`${letter}${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${c.allowed.filter(Boolean).join(",")}"`],
        };
      }
    });
    ws.eachRow((row) => {
      row.alignment = { wrapText: true, vertical: "top" };
    });
  }
  await wb.xlsx.writeFile(out);
  console.log(`Wrote ${out}`);
}

main();
