import { describe, expect, it } from "vitest";
import { dataset as ds } from "../lib/data/load";
import { nextQuestion } from "../lib/engine/next-question";
import { parseAnswerMap, parseAnswerString, simulateAdaptive } from "../lib/engine/profile";
import { screenAll, statusMap } from "../lib/engine/screen";
import type { Answer, Answers, Fact } from "../lib/engine/types";
import { ReadSequence, type ReadState, type Segment, type SegmentEvents, type SegmentPlayer } from "../lib/a11y/read-sequence";
import { answerFor, easyOptions, easyReducer, selectionFor, type EasyState } from "../lib/easy/options";
import { buildChecklist } from "../lib/checklist";
import { drive as driveWith, easyPick, sameInBothModes, standardPick } from "../lib/easy/equivalence";
import { channelFor, channelsForScheme, channelsForSchemes, directionsUrl, distanceTo, phones } from "../lib/offices";
import { STRINGS } from "../lib/i18n/strings";

const scheme = (id: string) => ds.schemes.find((s) => s.id === id)!;
const profile = (id: string) => ds.profiles.find((p) => p.id === id)!;

function easyPickChecked(fact: Fact, choices: Answer[], want: Answer | undefined): Answer {
  const options = easyOptions(fact, choices, "ml", { allowUnknown: true });
  const reduce = easyReducer(fact.type === "multi", options);
  let state: EasyState = { selected: [], speakingId: null };
  for (const o of options) state = reduce(reduce(state, { type: "speaking", id: o.id }), { type: "speaking", id: null });
  expect(state.selected).toEqual([]);
  return easyPick(fact, choices, want);
}

describe("Easy Mode is a presentation layer only", () => {
  for (const p of ds.profiles) {
    it(`profile ${p.id} gives the same results in Standard and Easy Mode`, () => {
      const full = parseAnswerMap(ds, p.answers);
      const standard = driveWith(ds, full, standardPick);
      const easy = driveWith(ds, full, easyPickChecked);
      expect(easy).toEqual(standard);
      expect(sameInBothModes(ds, p)).toBe(true);
      expect(standard).toEqual(statusMap(screenAll(ds, simulateAdaptive(ds, full).answers)));
    });
  }
  it("switching mode in the middle of a flow does not change the result", () => {
    const full = parseAnswerMap(ds, profile("P-13").answers);
    const answers: Answers = {};
    let turn = 0;
    for (let i = 0; i < 200; i++) {
      const q = nextQuestion(ds, answers);
      if (!q) break;
      answers[q.fact.id] = (turn++ % 2 ? easyPick : standardPick)(q.fact, q.choices, full[q.fact.id]);
    }
    expect(statusMap(screenAll(ds, answers))).toEqual(driveWith(ds, full, standardPick));
  });
  it("offers I don't know on every screened question, and Prefer not to say on sensitive ones", () => {
    for (const f of ds.facts) {
      const opts = easyOptions(f, f.type === "boolean" ? [{ kind: "value", value: true }, { kind: "value", value: false }] : f.options.map((o) => ({ kind: "value", value: o.value }) as Answer), "en");
      expect(opts.some((o) => o.kind === "unknown")).toBe(true);
      expect(opts.some((o) => o.kind === "declined")).toBe(f.sensitivity === "high");
    }
  });
  it("multi-select: None and I don't know clear the other choices", () => {
    const f = ds.facts.find((x) => x.id === "family_event")!;
    const opts = easyOptions(f, f.options.map((o) => ({ kind: "value", value: o.value }) as Answer), "en");
    const reduce = easyReducer(true, opts);
    const id = (v: string) => opts.find((o) => o.value === v)!.id;
    let s: EasyState = { selected: [], speakingId: null };
    s = reduce(s, { type: "select", id: id("delivery") });
    s = reduce(s, { type: "select", id: id("accident") });
    expect(answerFor(f, opts, s.selected)).toEqual({ kind: "value", value: ["delivery", "accident"] });
    s = reduce(s, { type: "select", id: id("none") });
    expect(s.selected).toEqual([id("none")]);
    s = reduce(s, { type: "select", id: id("delivery") });
    expect(s.selected).toEqual([id("delivery")]);
    s = reduce(s, { type: "select", id: "unknown" });
    expect(answerFor(f, opts, s.selected)).toEqual({ kind: "unknown" });
  });
});

class FakePlayer implements SegmentPlayer {
  current: { seg: Segment; ev: SegmentEvents } | null = null;
  cancelled: string[] = [];
  constructor(private ok: (s: Segment) => boolean = () => true) {}
  available = (s: Segment) => this.ok(s);
  play = (seg: Segment, ev: SegmentEvents) => {
    this.current = { seg, ev };
    return () => {
      this.cancelled.push(seg.id);
      this.current = null;
    };
  };
  startNow() {
    this.current?.ev.onStart();
  }
  endNow() {
    const c = this.current;
    this.current = null;
    c?.ev.onEnd();
  }
}

const SEGS: Segment[] = [
  { id: "question", text: "Are you a member?" },
  { id: "c0", text: "Yes" },
  { id: "c1", text: "No" },
  { id: "unknown", text: "I don't know" },
];

describe("read-aloud with option highlighting", () => {
  it("highlights each option only while it is being spoken", () => {
    const player = new FakePlayer();
    const seen: (string | null)[] = [];
    const seq = new ReadSequence(player, (s) => seen.push(s.speakingId));
    seq.start(SEGS);
    for (const s of SEGS) {
      expect(player.current?.seg.id).toBe(s.id);
      player.startNow();
      expect(seq.state.speakingId).toBe(s.id);
      player.endNow();
      if (seq.state.playing) expect(seq.state.speakingId).toBeNull();
    }
    expect(seq.state).toEqual({ playing: false, speakingId: null, unavailable: false });
    expect(seen.filter(Boolean)).toEqual(["question", "c0", "c1", "unknown"]);
  });
  it("speaking never selects an answer", () => {
    const f = ds.facts.find((x) => x.id === "kfwfb_member")!;
    const opts = easyOptions(f, [{ kind: "value", value: true }, { kind: "value", value: false }], "en");
    const reduce = easyReducer(false, opts);
    const player = new FakePlayer();
    let state: EasyState = { selected: [], speakingId: null };
    const seq = new ReadSequence(player, (s: ReadState) => (state = reduce(state, { type: "speaking", id: s.speakingId })));
    seq.start([{ id: "question", text: "q" }, ...opts.map((o) => ({ id: o.id, text: o.label }))]);
    while (player.current) {
      player.startNow();
      expect(state.selected).toEqual([]);
      player.endNow();
    }
    expect(state.selected).toEqual([]);
    expect(answerFor(f, opts, state.selected)).toBeNull();
  });
  it("a tap while audio plays stops speech and selects that option", () => {
    const f = ds.facts.find((x) => x.id === "kfwfb_member")!;
    const opts = easyOptions(f, [{ kind: "value", value: true }, { kind: "value", value: false }], "en");
    const reduce = easyReducer(false, opts);
    const player = new FakePlayer();
    let state: EasyState = { selected: [], speakingId: null };
    const seq = new ReadSequence(player, (s) => (state = reduce(state, { type: "speaking", id: s.speakingId })));
    seq.start(opts.map((o) => ({ id: o.id, text: o.label })));
    player.startNow();
    expect(state.speakingId).toBe("c0");
    seq.stop();
    state = reduce(state, { type: "select", id: "c1" });
    expect(player.cancelled).toEqual(["c0"]);
    expect(player.current).toBeNull();
    expect(state).toEqual({ selected: ["c1"], speakingId: null });
    expect(seq.state.playing).toBe(false);
    expect(answerFor(f, opts, state.selected)).toEqual({ kind: "value", value: false });
  });
  it("late events from a stopped read are ignored", () => {
    const player = new FakePlayer();
    const seq = new ReadSequence(player, () => {});
    seq.start(SEGS);
    const stale = player.current!;
    seq.stop();
    stale.ev.onStart();
    stale.ev.onEnd();
    expect(seq.state.speakingId).toBeNull();
    expect(seq.state.playing).toBe(false);
  });
  it("a failing segment is skipped instead of blocking", () => {
    const player = new FakePlayer();
    const seq = new ReadSequence(player, () => {});
    seq.start(SEGS);
    player.current!.ev.onError();
    expect(player.current?.seg.id).toBe("c0");
  });
  it("unavailable speech reports unavailable and input still works", () => {
    const player = new FakePlayer(() => false);
    const seq = new ReadSequence(player, () => {});
    seq.start(SEGS);
    expect(seq.state).toEqual({ playing: false, speakingId: null, unavailable: true });
    const f = ds.facts.find((x) => x.id === "kfwfb_member")!;
    const opts = easyOptions(f, [{ kind: "value", value: true }, { kind: "value", value: false }], "en");
    const s = easyReducer(false, opts)({ selected: [], speakingId: null }, { type: "select", id: "c0" });
    expect(answerFor(f, opts, s.selected)).toEqual({ kind: "value", value: true });
  });
  it("Listen again replays from the question", () => {
    const player = new FakePlayer();
    const seq = new ReadSequence(player, () => {});
    seq.start(SEGS);
    player.startNow();
    player.endNow();
    seq.start(SEGS);
    expect(player.current?.seg.id).toBe("question");
  });
});

function resultsFor(answers: string) {
  return screenAll(ds, parseAnswerString(ds, answers));
}

describe("document checklist", () => {
  it("merges duplicate documents and keeps every scheme that needs them", () => {
    const results = resultsFor(profile("P-18").answers ? Object.entries(profile("P-18").answers).map(([k, v]) => `${k}=${v}`).join("; ") : "");
    const c = buildChecklist(ds, results);
    const ids = c.schemes.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["FISH-12", "FISH-13"]));
    const counts = new Map<string, number>();
    for (const r of results.filter((x) => x.status === "potentially_eligible")) for (const d of r.documents) counts.set(d.doc.id, (counts.get(d.doc.id) ?? 0) + 1);
    expect(c.docs.map((d) => d.docId).sort()).toEqual([...counts.keys()].sort());
    for (const d of c.docs) expect(d.schemes.length).toBe(counts.get(d.docId));
    const shared = c.docs.filter((d) => d.schemes.length > 1);
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.find((d) => d.docId === "death_certificate")?.schemes.map((s) => s.id).sort()).toEqual(["FISH-12", "FISH-13"]);
  });
  it("lists only documents present in the dataset", () => {
    const known = new Set(ds.documents.map((d) => d.id));
    for (const p of ds.profiles) {
      const c = buildChecklist(ds, screenAll(ds, parseAnswerMap(ds, p.answers)));
      for (const d of c.docs) expect(known.has(d.docId)).toBe(true);
    }
  });
  it("does not invent documents when the official list is not published", () => {
    const results = resultsFor("livelihood=fishing; active_fisher=yes; bpl=yes; traditional_fisher=yes");
    const c = buildChecklist(ds, results);
    const fish03 = c.schemes.find((s) => s.id === "FISH-03");
    expect(fish03?.documents).toBe("not_published");
    expect(c.withoutList.map((s) => s.id)).toContain("FISH-03");
    expect(c.docs.some((d) => d.schemes.some((s) => s.id === "FISH-03"))).toBe(false);
  });
  it("contains no household answers or identity data", () => {
    const answers = profile("P-13").answers;
    const c = buildChecklist(ds, screenAll(ds, parseAnswerMap(ds, answers)));
    const text = JSON.stringify(c);
    expect(text).not.toContain("49999");
    expect(text).not.toMatch(/aadhaar number|phone number|\bname\s*:/i);
    expect(Object.keys(c).sort()).toEqual(["docs", "partialList", "schemes", "withoutList"]);
    for (const s of c.schemes) expect(Object.keys(s).sort()).toEqual(["applyVerification", "apply", "authority", "documents", "id", "name"].sort());
    expect(buildChecklist.length).toBe(2);
  });
  it("carries where to apply for every scheme", () => {
    const c = buildChecklist(ds, screenAll(ds, parseAnswerMap(ds, profile("P-23").answers)));
    const p4 = c.schemes.find((s) => s.id === "PLNT-04")!;
    expect(p4.apply.map((a) => a.locationType)).toContain("plantation_district_office");
  });
});

describe("office finder", () => {
  it("a fisheries scheme only lists fisheries offices", () => {
    const ch = channelsForScheme(ds, scheme("FISH-01"), { district: "Kollam" });
    expect(ch.map((c) => c.locationType)).toEqual(["fisheries_district_office"]);
    expect(ch[0].offices.every((o) => o.location.type === "fisheries_district_office" && o.location.district === "Kollam")).toBe(true);
  });
  it("plantation offices follow the printed jurisdiction", () => {
    const idukki = channelFor(ds, "plantation_district_office", { district: "Idukki" });
    const names = idukki.offices.map((o) => o.location.area);
    expect(names).toEqual(expect.arrayContaining(["Peerumade", "Vandanmedu", "Munnar", "Aluva"]));
    expect(names).not.toContain("Pathanamthitta");
    expect(idukki.multipleForDistrict).toBe(true);
    expect(idukki.offices.find((o) => o.location.area === "Aluva")?.match).toBe("jurisdiction");
    const kottayam = channelFor(ds, "plantation_district_office", { district: "Kottayam" });
    expect(kottayam.status).toBe("ok");
    expect(kottayam.offices.map((o) => o.location.area)).toEqual(["Pathanamthitta"]);
    expect(kottayam.offices[0].match).toBe("jurisdiction");
  });
  it("works with a district alone when location is denied", () => {
    const ch = channelFor(ds, "fisheries_district_office", { district: "Wayanad", origin: null });
    expect(ch.status).toBe("ok");
    expect(ch.offices.length).toBe(1);
    expect(ch.offices[0].distanceKm).toBeUndefined();
    expect(channelFor(ds, "fisheries_district_office", { district: "" }).status).toBe("need_district");
  });
  it("never shows a distance without verified office coordinates", () => {
    const origin = { lat: 9.93, lng: 76.26 };
    for (const l of ds.locations) {
      const d = distanceTo(origin, l);
      if (l.lat === undefined || l.lng === undefined) expect(d).toBeUndefined();
    }
    const ch = channelFor(ds, "fisheries_district_office", { district: "Ernakulam", origin });
    for (const o of ch.offices) if (o.location.lat === undefined) expect(o.distanceKm).toBeUndefined();
    expect(distanceTo(origin, { ...ch.offices[0].location, lat: 9.93, lng: 76.26 })).toBe(0);
  });
  it("does not invent Matsyafed offices for the four unlisted districts", () => {
    for (const d of ["Pathanamthitta", "Idukki", "Palakkad", "Wayanad"]) {
      const ch = channelFor(ds, "matsyafed_office", { district: d });
      expect(ch.status).toBe("none_in_district");
      expect(ch.offices.every((o) => o.match === "nearest_other" && o.location.district !== d)).toBe(true);
      expect(ds.locations.some((l) => l.type === "matsyafed_office" && l.district === d)).toBe(false);
    }
  });
  it("keeps malformed contacts suppressed", () => {
    const wy = ds.locations.find((l) => l.type === "fisheries_district_office" && l.district === "Wayanad")!;
    expect(phones(wy.phone).join(" ")).not.toContain("60293214");
    expect(JSON.stringify(ds.locations.filter((l) => l.district === "Palakkad"))).not.toContain("gmai.com");
    expect(phones("0471-, 9496007050")).toEqual(["9496007050"]);
  });
  it("directions links need no API key and carry no household data", () => {
    const l = ds.locations.find((x) => x.type === "fisheries_district_office")!;
    const url = directionsUrl(l);
    expect(url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
    expect(url).not.toMatch(/key=/);
  });
  it("groups offices across schemes so one trip covers several", () => {
    const ch = channelsForSchemes(ds, [scheme("FISH-12"), scheme("FISH-13")], { district: "Kollam" });
    const fo = ch.find((c) => c.locationType === "fisheries_district_office")!;
    expect(fo.applies.map((a) => a.schemeId).sort()).toEqual(["FISH-12", "FISH-13"]);
  });
});

describe("judge-facing wording", () => {
  it("never promises a benefit", () => {
    const bad = Object.entries(STRINGS)
      .filter(([, v]) => /\b(approved|guaranteed?|definitely eligible|you will receive)\b/i.test(v.en))
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
