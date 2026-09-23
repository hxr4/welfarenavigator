export type Lang = "en" | "ml";
export type L10n = { en: string; ml: string };
export type Tri = "T" | "F" | "U";

export type FactType = "boolean" | "enum" | "multi" | "number";
export type Op =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "in"
  | "not_in"
  | "includes"
  | "excludes";

export type Sensitivity = "low" | "medium" | "high";
export type VerificationLevel = "verified" | "partial" | "informational";

export interface FactOption {
  value: string;
  label: L10n;
  synonyms: { en: string[]; ml: string[] };
  icon?: string;
}

export interface Fact {
  id: string;
  type: FactType;
  label: L10n;
  question: L10n;
  help?: L10n;
  unit?: "INR" | "years" | "count" | "";
  sensitivity: Sensitivity;
  order: number;
  options: FactOption[];
  audioMl?: string;
}

export type LeafValue = string | number | boolean | string[];

export interface SourceRef {
  sourceId: string;
  quote: string;
  locator?: string;
}

export interface Leaf {
  id: string;
  fact: string;
  op: Op;
  value: LeafValue;
  changeable: boolean;
  howTo?: L10n;
  source?: SourceRef;
  reviewedBy?: string;
}

export type RuleNode = { all: RuleNode[] } | { any: RuleNode[] } | { not: RuleNode } | Leaf;

export interface Condition {
  fact: string;
  op: Op;
  value: LeafValue;
}

export interface SchemeDocument {
  docId: string;
  when?: Condition;
  source?: SourceRef;
}

export interface SchemeApply {
  locationType: string;
  mode: "in_person" | "online" | "both";
  note?: L10n;
  source?: SourceRef;
}

export interface Scheme {
  id: string;
  name: L10n;
  authority: L10n;
  category: "fishing" | "plantation" | "both";
  summary: L10n;
  verification: {
    eligibility: VerificationLevel;
    documents: VerificationLevel;
    apply: VerificationLevel;
  };
  rule: RuleNode;
  documents: SchemeDocument[];
  apply: SchemeApply[];
  lastVerified?: string;
  verifiedBy?: string;
  notes?: string;
}

export interface Source {
  id: string;
  tier: 1 | 2 | 3;
  authority: string;
  title: string;
  url: string;
  docType: string;
  language: string;
  dateIssued?: string;
  accessedOn: string;
  localFile?: string;
  notes?: string;
}

export interface DocumentDef {
  id: string;
  name: L10n;
  issuedBy?: L10n;
  sourceId?: string;
}

export interface LocationType {
  id: string;
  label: L10n;
  scope: "district" | "state";
}

export interface Location {
  id: string;
  type: string;
  name: L10n;
  district: string;
  area?: string;
  address?: string;
  phone?: string;
  hours?: string;
  lat?: number;
  lng?: number;
  serves?: string[];
  jurisdiction?: string;
  sourceId?: string;
}

export interface Term {
  id: string;
  en: string;
  ml: string;
  context?: string;
  sourceId?: string;
}

export type ProfileKind = "standard" | "incomplete" | "boundary" | "conflict" | "mixed";

export interface Profile {
  id: string;
  title: string;
  kind: ProfileKind;
  answers: Record<string, string>;
  expected: Record<string, SchemeStatus>;
  expectedOthers?: SchemeStatus;
  expectedMissing: Record<string, string[]>;
  writtenBy?: string;
  notes?: string;
}

export interface Dataset {
  meta: { generatedAt: string; includesExamples: boolean; version: string };
  sources: Source[];
  facts: Fact[];
  schemes: Scheme[];
  documents: DocumentDef[];
  locationTypes: LocationType[];
  locations: Location[];
  terms: Term[];
  profiles: Profile[];
  disclaimer: Record<string, L10n>;
}

export type Answer =
  | { kind: "value"; value: boolean | string | string[] }
  | { kind: "range"; lo: number; hi: number }
  | { kind: "unknown" }
  | { kind: "declined" };

export type Answers = Record<string, Answer>;

export type SchemeStatus =
  | "potentially_eligible"
  | "needs_information"
  | "not_matched"
  | "informational";

export interface LeafResult {
  leaf: Leaf;
  result: Tri;
}

export interface OneStep {
  leaf: Leaf;
  becomes: SchemeStatus;
}

export interface ResolvedDocument {
  doc: DocumentDef;
  conditional: boolean;
  source?: SourceRef;
}

export interface SchemeResult {
  scheme: Scheme;
  status: SchemeStatus;
  leaves: LeafResult[];
  missingFacts: string[];
  failingLeaves: Leaf[];
  oneStep?: OneStep;
  documents: ResolvedDocument[];
}

export interface NextQuestion {
  fact: Fact;
  choices: Answer[];
  remainingUpperBound: number;
}
