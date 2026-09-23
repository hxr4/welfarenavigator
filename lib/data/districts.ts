export interface District {
  id: string;
  en: string;
  ml: string;
  hq: { lat: number; lng: number };
  aliases: string[];
}

export const DISTRICTS: District[] = [
  { id: "Thiruvananthapuram", en: "Thiruvananthapuram", ml: "തിരുവനന്തപുരം", hq: { lat: 8.5241, lng: 76.9366 }, aliases: ["trivandrum", "tvm"] },
  { id: "Kollam", en: "Kollam", ml: "കൊല്ലം", hq: { lat: 8.8932, lng: 76.6141 }, aliases: ["quilon", "klm"] },
  { id: "Pathanamthitta", en: "Pathanamthitta", ml: "പത്തനംതിട്ട", hq: { lat: 9.2648, lng: 76.787 }, aliases: ["pta"] },
  { id: "Alappuzha", en: "Alappuzha", ml: "ആലപ്പുഴ", hq: { lat: 9.4981, lng: 76.3388 }, aliases: ["alleppey", "alpy", "alp"] },
  { id: "Kottayam", en: "Kottayam", ml: "കോട്ടയം", hq: { lat: 9.5916, lng: 76.5222 }, aliases: ["ktym", "ktm"] },
  { id: "Idukki", en: "Idukki", ml: "ഇടുക്കി", hq: { lat: 9.8497, lng: 76.9681 }, aliases: ["idk", "painavu"] },
  { id: "Ernakulam", en: "Ernakulam", ml: "എറണാകുളം", hq: { lat: 10.0159, lng: 76.3419 }, aliases: ["ekm", "kochi", "cochin"] },
  { id: "Thrissur", en: "Thrissur", ml: "തൃശ്ശൂർ", hq: { lat: 10.5276, lng: 76.2144 }, aliases: ["trichur", "tsr"] },
  { id: "Palakkad", en: "Palakkad", ml: "പാലക്കാട്", hq: { lat: 10.7867, lng: 76.6548 }, aliases: ["palghat", "pkd"] },
  { id: "Malappuram", en: "Malappuram", ml: "മലപ്പുറം", hq: { lat: 11.051, lng: 76.0711 }, aliases: ["malapuram", "mlp"] },
  { id: "Kozhikode", en: "Kozhikode", ml: "കോഴിക്കോട്", hq: { lat: 11.2588, lng: 75.7804 }, aliases: ["kozhikkode", "calicut", "kkd"] },
  { id: "Wayanad", en: "Wayanad", ml: "വയനാട്", hq: { lat: 11.6103, lng: 76.0827 }, aliases: ["wynad", "kalpetta", "wyd"] },
  { id: "Kannur", en: "Kannur", ml: "കണ്ണൂർ", hq: { lat: 11.8745, lng: 75.3704 }, aliases: ["cannanore", "knr"] },
  { id: "Kasaragod", en: "Kasaragod", ml: "കാസർകോട്", hq: { lat: 12.5102, lng: 74.9852 }, aliases: ["kasargod", "kasargode", "kasaragode", "ksd"] },
];

export function canonicalDistrict(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const d = DISTRICTS.find((x) => x.id.toLowerCase() === s || x.aliases.includes(s));
  return d ? d.id : null;
}

export function districtLabel(id: string, lang: "en" | "ml"): string {
  const d = DISTRICTS.find((x) => x.id === id);
  return d ? d[lang] : id;
}

const KERALA = { minLat: 8.1, maxLat: 12.85, minLng: 74.8, maxLng: 77.45 };

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function estimateDistrict(p: { lat: number; lng: number }): { id: string; km: number } | null {
  if (p.lat < KERALA.minLat || p.lat > KERALA.maxLat || p.lng < KERALA.minLng || p.lng > KERALA.maxLng) return null;
  let best: { id: string; km: number } | null = null;
  for (const d of DISTRICTS) {
    const km = haversineKm(p, d.hq);
    if (!best || km < best.km) best = { id: d.id, km };
  }
  return best;
}
