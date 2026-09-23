import type { Dataset, Lang, SchemeStatus } from "../engine/types";
import { t, type StringKey } from "./strings";

export function statusLabel(ds: Dataset, status: SchemeStatus, lang: Lang): string {
  if (lang === "ml") {
    const term = ds.terms.find((x) => x.id === status);
    if (term?.ml) return term.ml;
  }
  return t(`st_${status}` as StringKey, lang);
}
