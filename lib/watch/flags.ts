import flagsJson from "../../data/source-flags.json";

export interface SourceFlag {
  since: string;
  sourceIds: string[];
  kinds: string[];
}

const flags = (flagsJson as { flags: Record<string, SourceFlag> }).flags;

export function sourceFlag(schemeId: string, all: Record<string, SourceFlag> = flags): SourceFlag | null {
  return all[schemeId] ?? null;
}
