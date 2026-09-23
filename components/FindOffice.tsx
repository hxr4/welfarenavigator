"use client";

import { useEffect, useRef, useState } from "react";
import { DISTRICTS, districtLabel, estimateDistrict, haversineKm } from "@/lib/data/districts";
import type { Dataset, Lang, Location, Scheme } from "@/lib/engine/types";
import { pick } from "@/lib/i18n/describe";
import { t, type StringKey } from "@/lib/i18n/strings";
import { PinIcon } from "./icons";
import { SourceNote } from "./SourceNote";

interface Props {
  ds: Dataset;
  scheme: Scheme;
  lang: Lang;
  district: string;
  onDistrict: (d: string) => void;
}

type LocState = "idle" | "locating" | "denied" | "outside" | "estimated";

function directionsUrl(l: Location): string {
  const q = l.lat !== undefined && l.lng !== undefined ? `${l.lat},${l.lng}` : [l.name.en, l.address, l.district, "Kerala"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function servesDistrict(l: Location, d: string): boolean {
  return l.district === d || (l.serves ?? []).includes(d);
}

function phones(raw?: string): string[] {
  return (raw ?? "").split(/[,/]/).map((p) => p.trim()).filter(Boolean);
}

export default function FindOffice({ ds, scheme, lang, district, onDistrict }: Props) {
  const [loc, setLoc] = useState<LocState>(district ? "idle" : "idle");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  function locate() {
    if (!("geolocation" in navigator)) return setLoc("denied");
    setLoc("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        const est = estimateDistrict(here);
        if (!est) return setLoc("outside");
        setOrigin(here);
        onDistrict(est.id);
        setArea("");
        setLoc("estimated");
      },
      () => setLoc("denied"),
      { timeout: 10000, maximumAge: 600000 },
    );
  }

  const types = scheme.apply.map((a) => ({ apply: a, type: ds.locationTypes.find((x) => x.id === a.locationType) }));
  const districtTypes = types.filter((x) => x.type?.scope !== "state").map((x) => x.apply.locationType);
  const areas = [
    ...new Set(
      ds.locations.filter((l) => districtTypes.includes(l.type) && servesDistrict(l, district) && l.area).map((l) => l.area as string),
    ),
  ].sort();
  const anyCoords = ds.locations.some((l) => districtTypes.includes(l.type) && l.lat !== undefined);

  return (
    <section className="panel" aria-labelledby="find-title">
      <h2 id="find-title" tabIndex={-1} ref={heading}>
        {t("findTitle", lang)}
      </h2>

      <div className="locator">
        <button type="button" className="btn" onClick={locate} disabled={loc === "locating"}>
          <PinIcon /> {t("useLocation", lang)}
        </button>
        <p className="note">{t("locationPrivacy", lang)}</p>
        <div aria-live="polite">
          {loc === "locating" && <p className="status">{t("locating", lang)}</p>}
          {loc === "denied" && <p className="status status-warn">{t("locationDenied", lang)}</p>}
          {loc === "outside" && <p className="status status-warn">{t("outsideKerala", lang)}</p>}
          {loc === "estimated" && <p className="status">{t("estimated", lang)}</p>}
        </div>
        <div className="fields">
          <label className="field">
            <span>{t("district", lang)}</span>
            <select
              id="find-district"
              value={district}
              onChange={(e) => {
                onDistrict(e.target.value);
                setArea("");
                setLoc("idle");
              }}
            >
              <option value="">{t("chooseDistrict", lang)}</option>
              {DISTRICTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d[lang]}
                </option>
              ))}
            </select>
          </label>
          {district && areas.length > 1 && (
            <label className="field">
              <span>{t("area", lang)}</span>
              <select id="find-area" value={area} onChange={(e) => setArea(e.target.value)}>
                <option value="">{t("allAreas", lang)}</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {types.map(({ apply, type }, i) => {
        const state = type?.scope === "state";
        const all = ds.locations.filter((l) => l.type === apply.locationType);
        let list = all;
        let elsewhere = false;
        if (!state) {
          list = district ? all.filter((l) => servesDistrict(l, district) && (!area || l.area === area)) : [];
          if (district && list.length === 0 && all.length > 0) {
            const hq = DISTRICTS.find((d) => d.id === district)?.hq;
            const hqOf = (l: Location) => DISTRICTS.find((d) => d.id === l.district)?.hq;
            list = hq
              ? [...all].sort((a, b) => haversineKm(hq, hqOf(a) ?? hq) - haversineKm(hq, hqOf(b) ?? hq)).slice(0, 2)
              : [];
            elsewhere = list.length > 0;
          }
        }
        if (origin) {
          list = [...list].sort((a, b) => {
            const da = a.lat !== undefined && a.lng !== undefined ? haversineKm(origin, { lat: a.lat, lng: a.lng }) : Infinity;
            const db = b.lat !== undefined && b.lng !== undefined ? haversineKm(origin, { lat: b.lat, lng: b.lng }) : Infinity;
            return da - db;
          });
        }
        return (
          <div key={i} className="channel">
            <h3>
              {pick(type?.label, lang) || apply.locationType}
              <span className="meta"> · {t(`mode_${apply.mode}` as StringKey, lang)}</span>
            </h3>
            {apply.note && <p>{pick(apply.note, lang)}</p>}
            {state && <p className="note">{t("stateOffice", lang)}</p>}
            {!state && !district && <p className="note">{t("chooseDistrict", lang)}</p>}
            {!state && district && (list.length === 0 || elsewhere) && <p className="note">{t("noOffice", lang)}</p>}
            {elsewhere && <p className="note">{t("nearestOther", lang)}</p>}
            <ul className="offices">
              {list.map((l) => {
                const km = origin && l.lat !== undefined && l.lng !== undefined ? haversineKm(origin, { lat: l.lat, lng: l.lng }) : null;
                return (
                  <li key={l.id} className="office">
                    <p className="office-name">{pick(l.name, lang)}</p>
                    {km !== null && <p className="meta">{t("kmAway", lang, { n: km.toFixed(1) })}</p>}
                    <p className="meta">
                      {l.address ?? t("addressNotPublished", lang)}
                      {state || elsewhere ? ` · ${districtLabel(l.district, lang)}` : ""}
                    </p>
                    {l.jurisdiction && <p className="meta">{t("serves", lang)}: {l.jurisdiction}</p>}
                    {l.hours && <p className="meta">{l.hours}</p>}
                    <div className="row">
                      {phones(l.phone).map((p) => (
                        <a key={p} className="btn btn-small" href={`tel:${p.replace(/[^\d+]/g, "")}`}>
                          {t("phone", lang)}: {p}
                        </a>
                      ))}
                      <a className="btn btn-small" href={directionsUrl(l)} target="_blank" rel="noreferrer noopener">
                        {t("directions", lang)} ↗
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
            <SourceNote ds={ds} sourceId={apply.source?.sourceId} quote={apply.source?.quote} lang={lang} />
          </div>
        );
      })}
      {origin && !anyCoords && <p className="note">{t("noDistance", lang)}</p>}
      {scheme.verification.apply !== "verified" && <p className="notice">{t("applyPartial", lang)}</p>}
    </section>
  );
}
