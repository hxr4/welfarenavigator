# Welfare Navigator — ANAVANDI FutureBuild 2026, PS-07

A Malayalam and English screening assistant for fishing and plantation families in Kerala. It asks only the questions needed to decide the curated scheme rules. It shows the schemes a household is **potentially eligible** for, explains every result with the official clause behind it, lists the documents to take and says where to apply.

Rules decide eligibility. No AI model is involved in screening.

## Run

```bash
npm install
npm run data          # convert dataset/anavandi-dataset.xlsx -> data/dataset.json (validates everything)
npm test              # engine tests + dataset tests + wording checks
npm run dev           # http://localhost:3000
npm run build && npm start   # production build, works offline except voice
```

Reviewer page: `/review` — dataset audit, profile tests, generated rule checks and a box to screen any household.
API: `POST /api/screen` with `{"answers": {"fact": "value"}}`, `GET /api/health`.

## How it works

1. **Dataset** (`dataset/anavandi-dataset.xlsx`): curated by our team from official Kerala Government sources. Every condition stores the source, the exact quote and who cross-checked it. A scheme is screened only if its eligibility is `verified`; `partial` and `informational` schemes are listed as "ask at the office".
2. **Converter** (`scripts/build-data.ts`): turns the workbook into `data/dataset.json`. It refuses missing quotes, tier-3 sources used as rules, tracking URLs, unknown facts or options, and invalid operators.
3. **Engine** (`lib/engine`): three-valued logic (true / false / unknown). Missing information never rejects a scheme on its own. Number questions are asked as ranges built from the rule limits, so no one is asked for an exact income.
4. **Adaptive questions** (`lib/engine/next-question.ts`): the next question is the one that is guaranteed to settle the most undecided schemes. Sensitive questions come last. It stops when every scheme is decided or only unknowns remain.
5. **One step away**: for schemes that fail only on something the family can change (for example, board registration), the result says what to do.

## Privacy

- No name, phone number, ID number, account or database.
- Answers live in the browser tab's memory. They are cleared on "Clear my information" or after 10 minutes idle.
- Screening runs in the browser. The API is stateless and logs nothing.
- Voice input uses the browser's speech service, which sends audio to Google. This is disclosed in the app.

## AI use (declared)

- The code was written with an AI coding assistant (Claude) during the event, after coding started.
- The engine, rules and dataset contain no AI at runtime. The dataset was curated by hand from official sources.
- Voice input uses the browser's built-in speech recognition.

See `FEEDBACK.md` for how each evaluation round's feedback was addressed.
