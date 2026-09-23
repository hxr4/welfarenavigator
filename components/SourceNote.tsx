"use client";

import type { Dataset, Lang } from "@/lib/engine/types";
import { t, type StringKey } from "@/lib/i18n/strings";

interface Props {
  ds: Dataset;
  sourceId?: string;
  quote?: string;
  locator?: string;
  lang: Lang;
}

export function SourceNote({ ds, sourceId, quote, locator, lang }: Props) {
  const src = ds.sources.find((s) => s.id === sourceId);
  if (!src) return null;
  return (
    <details className="source">
      <summary>
        {t("source", lang)}: {src.authority}
      </summary>
      {quote && <blockquote lang="en">“{quote}”</blockquote>}
      <p className="meta">
        {src.title}
        {locator ? ` · ${locator}` : ""} · {t(`tier${src.tier}` as StringKey, lang)} · {src.accessedOn}
      </p>
      {src.url ? (
        <a href={src.url} target="_blank" rel="noreferrer noopener">
          {t("openSource", lang)} ↗
        </a>
      ) : (
        src.localFile && <p className="meta">{src.localFile}</p>
      )}
    </details>
  );
}
