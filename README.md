# Welfare Navigator — ANAVANDI FutureBuild 2026, PS-07

A Malayalam and English screening service for fishing and plantation families in Kerala. It asks only the questions that change the result, shows which schemes a household is **potentially eligible** for with the official clause behind each one, lists the documents that are officially published, and finds the right office in any of the 14 districts.

Eligibility is decided by a deterministic rules engine. No AI model runs in the app.

## Run

```bash
npm install
npm run data            # dataset/anavandi-dataset.xlsx -> data/dataset.json, with validation
npm test                # engine, dataset, adaptive-flow, location and wording tests
npm run dev             # http://localhost:3000   (reviewer page: /review)
npm run build && npm start   # production build; works offline except voice and maps links
npm run i18n:review     # regenerate docs/malayalam-review.md
npm run audio           # list Malayalam clips to record; index recorded clips in public/audio/ml
```

## Architecture

```
dataset/anavandi-dataset.xlsx   curated by the team from official sources (every rule: source, exact quote, locator)
        │  scripts/build-data.ts  (validates: facts, operators, quotes, tiers, districts, tracking URLs)
        ▼
data/dataset.json
        │
lib/engine        three-valued rules engine (all / any / not; eq neq lt lte gt gte in not_in includes excludes)
  evaluate.ts     TRUE / FALSE / UNKNOWN per condition and per scheme
  bands.ts        number questions asked as ranges cut at the rule limits (threshold privacy)
  next-question   picks the unanswered fact that settles the most undecided schemes; sensitive facts last
  screen.ts       status, reasons, missing facts, one-step-away, documents
        │
components        step-by-step UI (language → work → questions → results → scheme → office)
app/api/screen    same engine as a stateless endpoint for reviewers
```

UI answers are turned into normalised features before the engine sees them (for example the button "Fishing" becomes `livelihood includes "fishing"`; an income range becomes an interval). The engine never sees raw text.

## Privacy

- No name, phone, Aadhaar number, email or address is asked. There is no free-text input.
- Screening runs in the browser. Answers live in memory only, never in the URL or browser storage, and are erased by "Clear my information", by closing the tab, or after 10 minutes idle (3 minutes in assisted mode).
- The API is stateless, logs nothing and sends `Cache-Control: no-store`. No analytics or error-reporting services.
- Location is used only in the browser to guess the district from the 14 district headquarters; it is never sent anywhere. The "Directions" link carries only the office name and address.
- Limitation: voice input uses the browser's speech service (Chrome sends the audio to Google). This is disclosed; tap input always works.

## Accessibility

- Every question can be answered by tap; voice and read-aloud are extras.
- Voice: speech is matched only against the current question's options, shown back ("You said… We understood…"), and committed only after Confirm. After two failed attempts the voice button is withdrawn for that question.
- Read-aloud: English uses the browser voice. Malayalam uses recorded clips from `public/audio/ml` when present, otherwise a Malayalam browser voice if the device has one; otherwise the button is replaced by a note. `docs/malayalam-audio-clips.csv` lists every clip to record.
- Screen readers: headings receive focus on every step, status changes are announced, conditions carry text labels (met / not met / not known), large targets, high contrast, visible focus.

## Dataset status

See `/review` for live numbers and `docs/sources-needed.md` for the official documents the team still needs to collect. Malayalam strings still to be reviewed are in `docs/malayalam-review.md`.

## AI use (declared)

- Code written with an AI coding assistant (Claude) during the event.
- Parts of the dataset were drafted with AI assistance and checked by the team against the cited official pages. Rows added during AI review are marked `AI-review` and `PENDING_SECOND_REVIEW` until a team member cross-checks them.
- No AI at runtime. See `docs/llm-rag.md` for why RAG was not added.
