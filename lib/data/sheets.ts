export interface ColumnSpec {
  key: string;
  required?: boolean;
  allowed?: string[];
  width?: number;
  help: string;
}

export interface SheetSpec {
  name: string;
  purpose: string;
  columns: ColumnSpec[];
  examples: Record<string, string | number>[];
}

const VERIFICATION = ["verified", "partial", "informational"];
const OPS = ["eq", "neq", "lt", "lte", "gt", "gte", "in", "not_in", "includes", "excludes"];

export const SHEETS: SheetSpec[] = [
  {
    name: "sources",
    purpose: "Every official document or page a rule, document requirement or office comes from.",
    columns: [
      { key: "source_id", required: true, width: 12, help: "Unique id, e.g. SRC-001" },
      { key: "tier", required: true, allowed: ["1", "2", "3"], width: 6, help: "1 = Act, Rules, Gazette, Government Order, official scheme guideline. 2 = official department or welfare board web page. 3 = official report (discovery only, never a rule source)." },
      { key: "authority", required: true, width: 28, help: "Issuing body, e.g. Fisheries Department, Government of Kerala" },
      { key: "title", required: true, width: 40, help: "Exact title of the document or page, with GO number if any" },
      { key: "url", width: 45, help: "Official URL. Remove tracking parts like ?utm_source=... Leave blank only for a document collected by hand, and then fill local_file." },
      { key: "doc_type", required: true, allowed: ["act", "rules", "gazette", "government_order", "scheme_guideline", "department_page", "board_page", "report", "other"], width: 18, help: "Kind of document" },
      { key: "language", required: true, allowed: ["en", "ml", "en+ml"], width: 8, help: "Language of the document" },
      { key: "date_issued", width: 12, help: "YYYY-MM-DD if the document shows a date" },
      { key: "accessed_on", required: true, width: 12, help: "YYYY-MM-DD you opened it" },
      { key: "local_file", width: 28, help: "File name of the saved copy inside the sources/ folder" },
      { key: "notes", width: 30, help: "Anything odd: outdated, conflicts with another source, scanned PDF" },
    ],
    examples: [
      { source_id: "EXAMPLE-SRC-1", tier: 1, authority: "Example Department", title: "Example Government Order No. 00/2026", url: "https://example.gov.in/order.pdf", doc_type: "government_order", language: "ml", date_issued: "2026-01-01", accessed_on: "2026-09-23", local_file: "EXAMPLE-SRC-1.pdf", notes: "Example row. Rows whose id starts with EXAMPLE are ignored." },
    ],
  },
  {
    name: "facts",
    purpose: "The household details the app may ask. Only add a fact if at least one scheme condition needs it.",
    columns: [
      { key: "fact_id", required: true, width: 22, help: "snake_case id, e.g. fwf_member, annual_income" },
      { key: "type", required: true, allowed: ["boolean", "enum", "multi", "number"], width: 10, help: "boolean = yes/no. enum = pick one. multi = pick any. number = income, age (the app asks in ranges built from the rule limits)." },
      { key: "label_en", required: true, width: 26, help: "Short name, e.g. Yearly family income" },
      { key: "label_ml", required: true, width: 26, help: "Short name in Malayalam" },
      { key: "question_en", required: true, width: 40, help: "Question as the app will ask it, simple words" },
      { key: "question_ml", required: true, width: 40, help: "Same question in simple Malayalam" },
      { key: "help_en", width: 30, help: "Optional one-line help" },
      { key: "help_ml", width: 30, help: "Optional one-line help in Malayalam" },
      { key: "unit", allowed: ["INR", "years", "count", ""], width: 8, help: "For number facts" },
      { key: "sensitivity", required: true, allowed: ["low", "medium", "high"], width: 11, help: "high = health, disability, death, caste. High facts are asked last and get a Prefer not to say option." },
      { key: "ask_order", required: true, width: 9, help: "Tie-break order, smaller first" },
      { key: "audio_ml", width: 20, help: "File name of recorded Malayalam question in public/audio/" },
    ],
    examples: [
      { fact_id: "EXAMPLE-livelihood", type: "multi", label_en: "Family livelihood", label_ml: "കുടുംബത്തിന്റെ തൊഴിൽ", question_en: "What work does your family do?", question_ml: "നിങ്ങളുടെ കുടുംബം എന്ത് തൊഴിലാണ് ചെയ്യുന്നത്?", sensitivity: "low", ask_order: 1 },
    ],
  },
  {
    name: "options",
    purpose: "Answer choices for enum and multi facts.",
    columns: [
      { key: "fact_id", required: true, width: 22, help: "Fact this option belongs to" },
      { key: "value", required: true, width: 18, help: "snake_case value used in conditions, e.g. fishing" },
      { key: "label_en", required: true, width: 24, help: "Button text" },
      { key: "label_ml", required: true, width: 24, help: "Button text in Malayalam" },
      { key: "synonyms_en", width: 30, help: "Words people may say for voice, separated by |" },
      { key: "synonyms_ml", width: 30, help: "Malayalam words people may say, separated by |" },
      { key: "icon", width: 8, help: "One emoji shown on the button" },
    ],
    examples: [
      { fact_id: "EXAMPLE-livelihood", value: "fishing", label_en: "Fishing", label_ml: "മത്സ്യബന്ധനം", synonyms_en: "fishing|fisherman|sea", synonyms_ml: "മത്സ്യബന്ധനം|മീൻപിടുത്തം|കടൽ", icon: "🎣" },
      { fact_id: "EXAMPLE-livelihood", value: "plantation", label_en: "Plantation work", label_ml: "തോട്ടം തൊഴിൽ", synonyms_en: "plantation|estate|tea", synonyms_ml: "തോട്ടം|എസ്റ്റേറ്റ്|തേയില", icon: "🌱" },
    ],
  },
  {
    name: "schemes",
    purpose: "One row per welfare scheme or benefit.",
    columns: [
      { key: "scheme_id", required: true, width: 12, help: "e.g. FISH-01, PLNT-01" },
      { key: "name_en", required: true, width: 32, help: "Official name in English" },
      { key: "name_ml", required: true, width: 32, help: "Official name in Malayalam (from an official Malayalam source where possible)" },
      { key: "authority_en", required: true, width: 28, help: "Who runs it" },
      { key: "authority_ml", required: true, width: 28, help: "Who runs it, in Malayalam" },
      { key: "category", required: true, allowed: ["fishing", "plantation", "both"], width: 11, help: "Family type it serves" },
      { key: "summary_en", required: true, width: 40, help: "One or two plain sentences: what the family gets" },
      { key: "summary_ml", required: true, width: 40, help: "Same in Malayalam" },
      { key: "eligibility_verification", required: true, allowed: VERIFICATION, width: 14, help: "verified = every condition has an official quote. partial = some conditions unknown. informational = display only." },
      { key: "documents_verification", required: true, allowed: VERIFICATION, width: 14, help: "Is the document list from an official source?" },
      { key: "apply_verification", required: true, allowed: VERIFICATION, width: 14, help: "Is where-to-apply from an official source?" },
      { key: "last_verified", required: true, width: 12, help: "YYYY-MM-DD" },
      { key: "verified_by", required: true, width: 12, help: "Initials of who checked it" },
      { key: "notes", width: 30, help: "Gaps, conflicts, things to confirm" },
    ],
    examples: [
      { scheme_id: "EXAMPLE-1", name_en: "Example Scheme", name_ml: "ഉദാഹരണ പദ്ധതി", authority_en: "Example Board", authority_ml: "ഉദാഹരണ ബോർഡ്", category: "fishing", summary_en: "Example summary.", summary_ml: "ഉദാഹരണം.", eligibility_verification: "verified", documents_verification: "partial", apply_verification: "verified", last_verified: "2026-09-23", verified_by: "AB" },
    ],
  },
  {
    name: "conditions",
    purpose: "Eligibility conditions. Rows with the same scheme_id and the same group are alternatives (any one is enough). Different groups must all be met. For NOT use neq, not_in or excludes.",
    columns: [
      { key: "scheme_id", required: true, width: 12, help: "Scheme" },
      { key: "condition_id", required: true, width: 12, help: "Unique in the scheme, e.g. c1" },
      { key: "group", required: true, width: 8, help: "Group number. Same group = OR, different groups = AND" },
      { key: "fact_id", required: true, width: 22, help: "Fact being checked" },
      { key: "op", required: true, allowed: OPS, width: 9, help: "boolean: eq neq. number: lt lte gt gte eq. enum: eq neq in not_in. multi: includes excludes" },
      { key: "value", required: true, width: 18, help: "yes/no for boolean, a number (no commas) for number, option value(s) separated by | for enum/multi" },
      { key: "changeable", allowed: ["yes", "no"], width: 11, help: "yes if the family can act on it, e.g. register with the board. Drives the one-step-away hint." },
      { key: "how_to_en", width: 32, help: "If changeable: what to do, e.g. Register at your Matsyabhavan" },
      { key: "how_to_ml", width: 32, help: "Same in Malayalam" },
      { key: "source_id", required: true, width: 12, help: "Tier 1 or 2 source" },
      { key: "quote", required: true, width: 50, help: "Exact words from the source, copied, not paraphrased" },
      { key: "locator", width: 14, help: "Page, section or clause" },
      { key: "reviewed_by", width: 11, help: "Initials of the second person who checked the quote against the rule" },
    ],
    examples: [
      { scheme_id: "EXAMPLE-1", condition_id: "c1", group: 1, fact_id: "EXAMPLE-livelihood", op: "includes", value: "fishing", changeable: "no", source_id: "EXAMPLE-SRC-1", quote: "Exact sentence copied from the order.", locator: "para 2", reviewed_by: "HR" },
    ],
  },
  {
    name: "documents",
    purpose: "Every document a scheme may ask for.",
    columns: [
      { key: "doc_id", required: true, width: 20, help: "e.g. income_certificate" },
      { key: "name_en", required: true, width: 30, help: "Name in English" },
      { key: "name_ml", required: true, width: 30, help: "Name in Malayalam" },
      { key: "issued_by_en", width: 28, help: "Where the family gets it, e.g. Village Office" },
      { key: "issued_by_ml", width: 28, help: "Same in Malayalam" },
      { key: "source_id", width: 12, help: "Source for where it is issued" },
    ],
    examples: [{ doc_id: "EXAMPLE-doc", name_en: "Income Certificate", name_ml: "വരുമാന സർട്ടിഫിക്കറ്റ്", issued_by_en: "Village Office", issued_by_ml: "വില്ലേജ് ഓഫീസ്" }],
  },
  {
    name: "scheme_documents",
    purpose: "Which documents each scheme needs. Use when_* only if the document is needed in some cases.",
    columns: [
      { key: "scheme_id", required: true, width: 12, help: "Scheme" },
      { key: "doc_id", required: true, width: 20, help: "Document" },
      { key: "when_fact", width: 20, help: "Optional: only needed when this fact..." },
      { key: "when_op", allowed: OPS, width: 9, help: "...matches this operator..." },
      { key: "when_value", width: 14, help: "...and value" },
      { key: "source_id", width: 12, help: "Source" },
      { key: "quote", width: 40, help: "Exact words" },
    ],
    examples: [{ scheme_id: "EXAMPLE-1", doc_id: "EXAMPLE-doc", source_id: "EXAMPLE-SRC-1", quote: "Exact words." }],
  },
  {
    name: "location_types",
    purpose: "Kinds of place a family applies at.",
    columns: [
      { key: "type_id", required: true, width: 20, help: "e.g. akshaya, matsyabhavan, board_district_office" },
      { key: "label_en", required: true, width: 30, help: "Name in English" },
      { key: "label_ml", required: true, width: 30, help: "Name in Malayalam" },
      { key: "scope", allowed: ["district", "state", ""], width: 10, help: "district = one office per district. state = a single state-level office shown to everyone. Default district." },
    ],
    examples: [{ type_id: "EXAMPLE-akshaya", label_en: "Akshaya Centre", label_ml: "അക്ഷയ കേന്ദ്രം" }],
  },
  {
    name: "locations",
    purpose: "Actual offices and centres. Cover one or two districts properly.",
    columns: [
      { key: "location_id", required: true, width: 12, help: "e.g. LOC-001" },
      { key: "type_id", required: true, width: 20, help: "Location type" },
      { key: "name_en", required: true, width: 30, help: "Name" },
      { key: "name_ml", required: true, width: 30, help: "Name in Malayalam" },
      { key: "district", required: true, width: 14, help: "One of the 14 districts, official spelling (Kozhikode, Kasaragod)" },
      { key: "area", width: 18, help: "Panchayat, municipality or taluk" },
      { key: "address", width: 36, help: "Address" },
      { key: "phone", width: 14, help: "Public office phone only" },
      { key: "hours", width: 16, help: "Working hours" },
      { key: "lat", width: 10, help: "Latitude if known" },
      { key: "lng", width: 10, help: "Longitude if known" },
      { key: "serves_districts", width: 30, help: "Districts this office serves besides its own, separated by | (for offices whose jurisdiction crosses districts)" },
      { key: "jurisdiction", width: 36, help: "Jurisdiction exactly as the source states it, e.g. Pathanapuram and Kunnathur taluks of Kollam" },
      { key: "source_id", width: 12, help: "Where this address came from" },
    ],
    examples: [{ location_id: "EXAMPLE-LOC", type_id: "EXAMPLE-akshaya", name_en: "Example Akshaya Centre", name_ml: "ഉദാഹരണം", district: "Ernakulam", source_id: "EXAMPLE-SRC-1" }],
  },
  {
    name: "scheme_apply",
    purpose: "Where each scheme is applied for.",
    columns: [
      { key: "scheme_id", required: true, width: 12, help: "Scheme" },
      { key: "type_id", required: true, width: 20, help: "Location type" },
      { key: "mode", required: true, allowed: ["in_person", "online", "both"], width: 11, help: "How" },
      { key: "note_en", width: 34, help: "e.g. Submit through the Fisheries Officer" },
      { key: "note_ml", width: 34, help: "Same in Malayalam" },
      { key: "source_id", width: 12, help: "Source" },
      { key: "quote", width: 40, help: "Exact words" },
    ],
    examples: [{ scheme_id: "EXAMPLE-1", type_id: "EXAMPLE-akshaya", mode: "in_person", source_id: "EXAMPLE-SRC-1", quote: "Exact words." }],
  },
  {
    name: "terminology",
    purpose: "English–Malayalam term list used across the app. Prefer official Malayalam terms.",
    columns: [
      { key: "term_id", required: true, width: 20, help: "e.g. potentially_eligible" },
      { key: "en", required: true, width: 30, help: "English" },
      { key: "ml", required: true, width: 30, help: "Malayalam" },
      { key: "context", width: 30, help: "Where it is used" },
      { key: "source_id", width: 12, help: "Official source of the Malayalam term, blank if our own translation" },
    ],
    examples: [{ term_id: "EXAMPLE-term", en: "Welfare Fund Board", ml: "ക്ഷേമനിധി ബോർഡ്" }],
  },
  {
    name: "profiles",
    purpose: "Test households with the result you expect, written by reading the sources, not the conditions sheet.",
    columns: [
      { key: "profile_id", required: true, width: 12, help: "e.g. P-01" },
      { key: "title", required: true, width: 34, help: "e.g. Registered fisher, income 1.5 lakh" },
      { key: "kind", required: true, allowed: ["standard", "incomplete", "boundary", "conflict", "mixed"], width: 11, help: "incomplete = some answers unknown. boundary = exactly at a limit. mixed = fishing and plantation." },
      { key: "answers", required: true, width: 50, help: "fact=value; fact=value. Use unknown for I don't know. multi: fishing,plantation" },
      { key: "expected", required: true, width: 50, help: "SCHEME=status; ... status is potentially_eligible, needs_information or not_matched" },
      { key: "expected_others", allowed: ["", "potentially_eligible", "needs_information", "not_matched"], width: 16, help: "Status every scheme not listed must have. Usually not_matched." },
      { key: "expected_missing", width: 34, help: "SCHEME:fact,fact; ... facts the app must say are missing" },
      { key: "written_by", required: true, width: 11, help: "Initials" },
      { key: "notes", width: 30, help: "Why you expect this" },
    ],
    examples: [{ profile_id: "EXAMPLE-P", title: "Example", kind: "standard", answers: "EXAMPLE-livelihood=fishing", expected: "EXAMPLE-1=potentially_eligible", written_by: "AB" }],
  },
  {
    name: "disclaimer",
    purpose: "Fixed wording shown in the app. Key main is shown on every result screen.",
    columns: [
      { key: "key", required: true, width: 14, help: "main, privacy, not_official, voice" },
      { key: "en", required: true, width: 60, help: "English" },
      { key: "ml", required: true, width: 60, help: "Malayalam" },
    ],
    examples: [],
  },
];

export const DISCLAIMER_DRAFT: Record<string, { en: string; ml: string }> = {
  main: {
    en: "This screening shows schemes you may be potentially eligible for, based only on your answers. It is not a decision. The responsible office decides eligibility after checking your documents.",
    ml: "നിങ്ങളുടെ മറുപടികളെ മാത്രം അടിസ്ഥാനമാക്കി, നിങ്ങൾക്ക് സാധ്യതയുള്ള പദ്ധതികളാണ് ഇവിടെ കാണിക്കുന്നത്. ഇതൊരു തീരുമാനമല്ല. രേഖകൾ പരിശോധിച്ച ശേഷം ബന്ധപ്പെട്ട ഓഫീസാണ് അർഹത തീരുമാനിക്കുന്നത്.",
  },
  not_official: {
    en: "This is not an official Government of Kerala service. Scheme rules were collected by our team from the official sources listed, as of the date shown.",
    ml: "ഇത് കേരള സർക്കാരിന്റെ ഔദ്യോഗിക സേവനമല്ല. കാണിച്ചിരിക്കുന്ന തീയതി വരെയുള്ള ഔദ്യോഗിക രേഖകളിൽ നിന്ന് ഞങ്ങളുടെ ടീം ശേഖരിച്ചതാണ് പദ്ധതി നിയമങ്ങൾ.",
  },
  privacy: {
    en: "We do not ask for your name, phone number or ID numbers. Your answers stay in this browser tab and are erased when you press Clear or close the tab.",
    ml: "നിങ്ങളുടെ പേര്, ഫോൺ നമ്പർ, തിരിച്ചറിയൽ നമ്പറുകൾ എന്നിവ ഞങ്ങൾ ചോദിക്കുന്നില്ല. നിങ്ങളുടെ മറുപടികൾ ഈ ബ്രൗസർ ടാബിൽ മാത്രം നിൽക്കും; മായ്ക്കുക അമർത്തുമ്പോഴോ ടാബ് അടയ്ക്കുമ്പോഴോ അവ ഇല്ലാതാകും.",
  },
  voice: {
    en: "Voice input uses your browser's speech service, which sends the audio to Google to convert it to text.",
    ml: "ശബ്ദ ഇൻപുട്ട് ബ്രൗസറിന്റെ സ്പീച്ച് സേവനം ഉപയോഗിക്കുന്നു; ശബ്ദം ടെക്സ്റ്റാക്കാൻ അത് Google-ലേക്ക് അയയ്ക്കും.",
  },
};
