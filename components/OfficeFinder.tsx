"use client";

import { useEffect, useRef, useState } from "react";
import { DISTRICTS, districtLabel, estimateDistrict } from "@/lib/data/districts";
import type { Dataset, Lang, Scheme } from "@/lib/engine/types";
import { pick } from "@/lib/i18n/describe";
import { t, type StringKey } from "@/lib/i18n/strings";
import { areasFor, channelsForSchemes, directionsUrl, phones, telHref, type Channel, type OfficeMatch } from "@/lib/offices";
import { PhoneIcon, PinIcon } from "./icons";
import { SourceNote } from "./SourceNote";

interface Props {
  ds: Dataset;
  schemes: Scheme[];
  lang: Lang;
  district: string;
  onDistrict: (d: string) => void;
  headingLevel?: 1 | 2;
}

type LocState = "idle" | "asking" | "denied" | "outside" | "estimated";

function OfficeCard({ o, lang, located }: { o: OfficeMatch; lang: Lang; located: boolean }) {
  const l = o.location;
  return (
    <li className="office">
      <p className="office-name">{pick(l.name, lang)}</p>
      {o.match === "jurisdiction" && <p className="office-tag">{t("officeServesYou", lang)}</p>}
      {o.match === "nearest_other" && <p className="office-tag office-tag-warn">{t("officeOtherDistrict", lang, { d: districtLabel(l.district, lang) })}</p>}
      {located && (o.distanceKm !== undefined ? <p className="meta">{t("kmAway", lang, { n: o.distanceKm.toFixed(1) })}</p> : <p className="meta">{t("distanceUnavailable", lang)}</p>)}
      <p className="meta">
        {l.address ?? t("addressNotPublished", lang)}
        {o.match !== "district" ? ` · ${districtLabel(l.district, lang)}` : ""}
      </p>
      {l.jurisdiction && (
        <p className="meta">
          {t("serves", lang)}: {l.jurisdiction}
        </p>
      )}
      {l.hours && <p className="meta">{l.hours}</p>}
      <div className="row office-actions">
        {phones(l.phone).map((p) => (
          <a key={p} className="btn btn-small" href={telHref(p)} aria-label={`${t("call", lang)} ${pick(l.name, lang)}: ${p}`}>
            <PhoneIcon /> {t("call", lang)} {p}
          </a>
        ))}
        <a className="btn btn-small" href={directionsUrl(l)} target="_blank" rel="noreferrer noopener" aria-label={`${t("directions", lang)}: ${pick(l.name, lang)} (${t("opensMaps", lang)})`}>
          <PinIcon /> {t("directions", lang)} ↗
        </a>
      </div>
    </li>
  );
}

function ChannelBlock({ ds, c, lang, district, located, many }: { ds: Dataset; c: Channel; lang: Lang; district: string; located: boolean; many: boolean }) {
  const typeName = pick(c.type?.label, lang) || c.locationType;
  const modes = [...new Set(c.applies.map((a) => a.apply.mode))];
  return (
    <div className="channel">
      <h3>
        {typeName}
        <span className="meta"> · {modes.map((m) => t(`mode_${m}` as StringKey, lang)).join(", ")}</span>
      </h3>
      {many && (
        <p className="meta">
          {t("forSchemes", lang)}: {c.applies.map((a) => pick(a.schemeName, lang)).join(", ")}
        </p>
      )}
      {c.applies
        .filter((a) => a.apply.note)
        .slice(0, many ? 3 : 1)
        .map((a) => (
          <p key={a.schemeId}>
            {many && <strong>{pick(a.schemeName, lang)}: </strong>}
            {pick(a.apply.note, lang)}
          </p>
        ))}
      {c.state && <p className="note">{t("stateOffice", lang)}</p>}
      {c.status === "need_district" && <p className="note">{t("chooseDistrictFirst", lang)}</p>}
      {c.status === "none_listed" && <p className="notice">{t("noOfficeData", lang)}</p>}
      {c.status === "none_in_district" && (
        <>
          <p className="notice">{t("noOfficeInDistrict", lang, { type: typeName, d: districtLabel(district, lang) })}</p>
          {c.offices.length > 0 && <p className="note">{t("nearestOther", lang)}</p>}
        </>
      )}
      {c.multipleForDistrict && <p className="note">{t("pickByJurisdiction", lang)}</p>}
      <ul className="offices">
        {c.offices.map((o) => (
          <OfficeCard key={o.location.id} o={o} lang={lang} located={located} />
        ))}
      </ul>
      {!many && <SourceNote ds={ds} sourceId={c.applies[0]?.apply.source?.sourceId} quote={c.applies[0]?.apply.source?.quote} lang={lang} />}
    </div>
  );
}

export default function OfficeFinder({ ds, schemes, lang, district, onDistrict, headingLevel = 2 }: Props) {
  const [loc, setLoc] = useState<LocState>("idle");
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [area, setArea] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
    return () => setOrigin(null);
  }, []);

  function locate() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return setLoc("denied");
    setLoc("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        const est = estimateDistrict(here);
        if (!est) {
          setOrigin(null);
          return setLoc("outside");
        }
        setOrigin(here);
        onDistrict(est.id);
        setArea("");
        setLoc("estimated");
      },
      () => {
        setOrigin(null);
        setLoc("denied");
      },
      { timeout: 10000, maximumAge: 600000, enableHighAccuracy: false },
    );
  }

  const channels = channelsForSchemes(ds, schemes, { district, area, origin });
  const many = schemes.length > 1;
  const areas = district ? areasFor(ds, channels.filter((c) => !c.state).map((c) => c.locationType), district) : [];
  const H = headingLevel === 1 ? "h1" : "h2";

  return (
    <section className="panel finder" aria-labelledby="find-title">
      <H id="find-title" tabIndex={-1} ref={heading}>
        {many ? t("whereTitleAll", lang) : t("findTitle", lang)}
      </H>
      <p className="help">{t("whereIntro", lang)}</p>

      <div className="locator">
        <button type="button" className="btn btn-primary" onClick={locate} disabled={loc === "asking"}>
          <PinIcon /> {t("findNearest", lang)}
        </button>
        <p className="note">{t("locationPrivacy", lang)}</p>
        <div aria-live="polite">
          {loc === "asking" && <p className="status">{t("locating", lang)}</p>}
          {loc === "denied" && <p className="status status-warn">{t("locationDenied", lang)}</p>}
          {loc === "outside" && <p className="status status-warn">{t("outsideKerala", lang)}</p>}
          {loc === "estimated" && <p className="status">{t("estimated", lang)}</p>}
        </div>
        <div className="fields">
          <label className="field">
            <span>{t("district", lang)}</span>
            <select
              value={district}
              onChange={(e) => {
                onDistrict(e.target.value);
                setArea("");
                setOrigin(null);
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
          {areas.length > 1 && (
            <label className="field">
              <span>{t("area", lang)}</span>
              <select value={area} onChange={(e) => setArea(e.target.value)}>
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

      <div>
        {channels.map((c) => (
          <ChannelBlock key={c.locationType} ds={ds} c={c} lang={lang} district={district} located={!!origin} many={many} />
        ))}
      </div>
      {origin && channels.every((c) => c.offices.every((o) => o.distanceKm === undefined)) && <p className="note">{t("noDistance", lang)}</p>}
      {schemes.some((s) => s.verification.apply !== "verified") && <p className="notice">{t("applyPartial", lang)}</p>}
    </section>
  );
}
