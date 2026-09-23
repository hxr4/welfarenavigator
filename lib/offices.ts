import { DISTRICTS, haversineKm } from "./data/districts";
import type { Dataset, L10n, Location, LocationType, Scheme, SchemeApply } from "./engine/types";

export type MatchKind = "district" | "jurisdiction" | "state" | "nearest_other";

export interface OfficeMatch {
  location: Location;
  match: MatchKind;
  distanceKm?: number;
}

export type ChannelStatus = "ok" | "need_district" | "none_in_district" | "none_listed";

export interface Channel {
  locationType: string;
  type?: LocationType;
  state: boolean;
  offices: OfficeMatch[];
  status: ChannelStatus;
  multipleForDistrict: boolean;
  applies: { schemeId: string; schemeName: L10n; apply: SchemeApply }[];
}

export interface FinderInput {
  district: string;
  area?: string;
  origin?: { lat: number; lng: number } | null;
}

export function servesDistrict(l: Location, d: string): boolean {
  return l.district === d || (l.serves ?? []).includes(d);
}

export function hasCoords(l: Location): boolean {
  return typeof l.lat === "number" && typeof l.lng === "number" && Number.isFinite(l.lat) && Number.isFinite(l.lng);
}

export function distanceTo(origin: { lat: number; lng: number } | null | undefined, l: Location): number | undefined {
  if (!origin || !hasCoords(l)) return undefined;
  return haversineKm(origin, { lat: l.lat as number, lng: l.lng as number });
}

export function phones(raw?: string): string[] {
  return (raw ?? "").split(/[,/]/).map((p) => p.trim()).filter((p) => p.replace(/\D/g, "").length >= 6);
}

export function telHref(p: string): string {
  return `tel:${p.replace(/[^\d+]/g, "")}`;
}

export function directionsUrl(l: Location): string {
  const q = hasCoords(l) ? `${l.lat},${l.lng}` : [l.name.en, l.address, l.district, "Kerala"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function rank(list: OfficeMatch[], origin: FinderInput["origin"]): OfficeMatch[] {
  const order: Record<MatchKind, number> = { district: 0, jurisdiction: 1, state: 2, nearest_other: 3 };
  return [...list].sort((a, b) => {
    if (origin) {
      const da = a.distanceKm ?? Infinity;
      const db = b.distanceKm ?? Infinity;
      if (da !== db) return da - db;
    }
    return order[a.match] - order[b.match];
  });
}

function nearestOtherDistricts(all: Location[], district: string, n = 2): Location[] {
  const hq = DISTRICTS.find((d) => d.id === district)?.hq;
  if (!hq) return [];
  const hqOf = (l: Location) => DISTRICTS.find((d) => d.id === l.district)?.hq ?? hq;
  return [...all].sort((a, b) => haversineKm(hq, hqOf(a)) - haversineKm(hq, hqOf(b))).slice(0, n);
}

export function channelFor(ds: Dataset, locationType: string, input: FinderInput): Omit<Channel, "applies"> {
  const type = ds.locationTypes.find((t) => t.id === locationType);
  const state = type?.scope === "state";
  const all = ds.locations.filter((l) => l.type === locationType);
  const base = { locationType, type, state, multipleForDistrict: false };
  if (all.length === 0) return { ...base, offices: [], status: "none_listed" };
  if (state) {
    return { ...base, offices: rank(all.map((l) => ({ location: l, match: "state" as const, distanceKm: distanceTo(input.origin, l) })), input.origin), status: "ok" };
  }
  if (!input.district) return { ...base, offices: [], status: "need_district" };
  const inDistrict = all
    .filter((l) => servesDistrict(l, input.district))
    .filter((l) => !input.area || l.area === input.area || l.district !== input.district)
    .map((l) => ({ location: l, match: (l.district === input.district ? "district" : "jurisdiction") as MatchKind, distanceKm: distanceTo(input.origin, l) }));
  if (inDistrict.length > 0) {
    return { ...base, offices: rank(inDistrict, input.origin), status: "ok", multipleForDistrict: inDistrict.length > 1 && inDistrict.some((o) => !!o.location.jurisdiction) };
  }
  const others = nearestOtherDistricts(all, input.district).map((l) => ({ location: l, match: "nearest_other" as const, distanceKm: distanceTo(input.origin, l) }));
  return { ...base, offices: others, status: "none_in_district" };
}

export function channelsForScheme(ds: Dataset, scheme: Scheme, input: FinderInput): Channel[] {
  return scheme.apply.map((a) => ({ ...channelFor(ds, a.locationType, input), applies: [{ schemeId: scheme.id, schemeName: scheme.name, apply: a }] }));
}

export function channelsForSchemes(ds: Dataset, schemes: Scheme[], input: FinderInput): Channel[] {
  const byType = new Map<string, Channel>();
  for (const s of schemes) {
    for (const a of s.apply) {
      const existing = byType.get(a.locationType);
      if (existing) {
        existing.applies.push({ schemeId: s.id, schemeName: s.name, apply: a });
        continue;
      }
      byType.set(a.locationType, { ...channelFor(ds, a.locationType, input), applies: [{ schemeId: s.id, schemeName: s.name, apply: a }] });
    }
  }
  const weight = (c: Channel) => (c.locationType === "akshaya" ? 1 : 0) + (c.state ? 0.5 : 0);
  return [...byType.values()].sort((a, b) => weight(a) - weight(b) || b.applies.length - a.applies.length);
}

export function areasFor(ds: Dataset, locationTypes: string[], district: string): string[] {
  const set = new Set<string>();
  for (const l of ds.locations) {
    if (!locationTypes.includes(l.type) || l.district !== district || !l.area || l.jurisdiction) continue;
    set.add(l.area);
  }
  return [...set].sort();
}
