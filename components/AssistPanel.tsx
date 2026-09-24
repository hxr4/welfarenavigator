"use client";

import { useEffect, useMemo, useState } from "react";
import { deviceComplete, deviceStatus, type DeviceStatus } from "@/lib/assist/browser";
import { aiAllowed, buildPrompt, checkGrounding, gatherEvidence, isMalayalam, type Intent } from "@/lib/assist/evidence";
import type { Dataset, Lang, Scheme } from "@/lib/engine/types";
import { t, type StringKey } from "@/lib/i18n/strings";

interface Props {
  ds: Dataset;
  scheme: Scheme;
  lang: Lang;
}

type State = { kind: "idle" } | { kind: "loading" } | { kind: "ok"; text: string; where: "device" | "server" } | { kind: "fallback" };

const BUTTONS: [Intent, StringKey][] = [
  ["what", "assistWhat"],
  ["who", "assistWho"],
  ["documents", "assistDocs"],
  ["apply", "assistApply"],
];

export default function AssistPanel({ ds, scheme, lang }: Props) {
  const [intent, setIntent] = useState<Intent | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [available, setAvailable] = useState(false);
  const [online, setOnline] = useState(true);
  const [device, setDevice] = useState<DeviceStatus>("unavailable");

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    let live = true;
    if (navigator.onLine) {
      fetch("/api/assist", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { available: false }))
        .then((j: { available?: boolean }) => live && setAvailable(Boolean(j.available)))
        .catch(() => live && setAvailable(false));
    }
    return () => {
      live = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let live = true;
    deviceStatus(lang).then((d) => live && setDevice(d));
    return () => {
      live = false;
    };
  }, [lang]);

  useEffect(() => setState({ kind: "idle" }), [intent, lang, scheme.id]);

  const useDevice = device !== "unavailable";
  const canSimplify = intent !== null && aiAllowed(intent) && (useDevice || (available && online));

  const passages = useMemo(() => (intent ? gatherEvidence(ds, scheme.id, intent, lang) : []), [ds, scheme.id, intent, lang]);

  async function viaServer(): Promise<string | null> {
    if (!intent || !available || !navigator.onLine) return null;
    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schemeId: scheme.id, intent, lang }),
      });
      const j = (await res.json()) as { ok?: boolean; text?: string };
      return j.ok && j.text ? j.text : null;
    } catch {
      return null;
    }
  }

  async function simplify() {
    if (!intent) return;
    if (useDevice) {
      const { system, user } = buildPrompt(scheme, intent, lang, passages);
      const pending = deviceComplete(system, user, lang);
      setState({ kind: "loading" });
      try {
        const text = await pending;
        if (checkGrounding(text, passages).ok) return setState({ kind: "ok", text, where: "device" });
      } catch {}
      const server = await viaServer();
      return setState(server ? { kind: "ok", text: server, where: "server" } : { kind: "fallback" });
    }
    setState({ kind: "loading" });
    const server = await viaServer();
    setState(server ? { kind: "ok", text: server, where: "server" } : { kind: "fallback" });
  }

  return (
    <section className="panel assist" aria-labelledby="assist-title">
      <h2 id="assist-title">{t("assistTitle", lang)}</h2>
      <p className="meta">{t("assistHelp", lang)}</p>
      <div className="assist-intents" role="group" aria-label={t("assistTitle", lang)}>
        {BUTTONS.map(([id, key]) => (
          <button key={id} type="button" className="btn btn-small" aria-pressed={intent === id} onClick={() => setIntent(id)}>
            {t(key, lang)}
          </button>
        ))}
      </div>

      {intent && (
        <div aria-live="polite">
          {canSimplify && state.kind === "idle" && passages.length > 0 && (
            <>
              <button type="button" className="btn btn-quiet" onClick={simplify}>
                {t(useDevice ? "assistSimplifyDevice" : "assistSimplify", lang)}
              </button>
              <p className="meta">{t(useDevice ? "assistDeviceNote" : "assistSends", lang)}</p>
              {device === "downloadable" && <p className="meta">{t("assistDownload", lang)}</p>}
            </>
          )}
          {intent && !aiAllowed(intent) && (useDevice || available) && <p className="meta">{t("assistWhoNote", lang)}</p>}
          {state.kind === "loading" && <p className="meta">{t("assistWorking", lang)}</p>}
          {state.kind === "ok" && (
            <div className="assist-answer">
              <p className="notice">{t(state.where === "device" ? "assistMachineDevice" : "assistMachine", lang)}</p>
              <p lang={isMalayalam(state.text) ? "ml" : "en"}>{state.text}</p>
            </div>
          )}
          {state.kind === "fallback" && <p className="notice">{t("assistFallback", lang)}</p>}

          <h3>{t("assistOfficial", lang)}</h3>
          {passages.length === 0 ? (
            <p className="notice">{t("assistNothing", lang)}</p>
          ) : (
            <ol className="assist-quotes">
              {passages.map((p) => (
                <li key={p.n} value={p.n}>
                  <p className="meta">{p.label}</p>
                  <blockquote lang={isMalayalam(p.text) ? "ml" : "en"}>{p.text}</blockquote>
                  <p className="meta">
                    {p.sourceTitle ? `${p.authority ?? ""} · ${p.sourceTitle}${p.locator ? ` · ${p.locator}` : ""}` : t("assistTeamWritten", lang)}
                    {p.url && (
                      <>
                        {" · "}
                        <a href={p.url} target="_blank" rel="noreferrer noopener">
                          {t("openSource", lang)} ↗
                        </a>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
