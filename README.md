# Welfare Navigator

**ANAVANDI FutureBuild 2026 · Problem Statement 07**

Welfare Navigator is a bilingual Malayalam–English service that helps fishing and plantation families in Kerala discover government welfare schemes relevant to their circumstances.

The application asks only questions that can change a screening result, explains why each scheme matches or does not match, lists published document requirements, and identifies the appropriate application office across Kerala’s 14 districts.

> Welfare Navigator provides an initial screening, not a final government eligibility decision.

## Why it matters

Welfare information is often distributed across multiple government pages, forms, and offices. It can be difficult to interpret, especially for users who prefer Malayalam. Welfare Navigator brings this information into one guided flow while keeping the result transparent and privacy-conscious.

## Highlights

- Malayalam and English user experience
- Deterministic, explainable eligibility screening
- Adaptive questions that avoid unnecessary data collection
- Privacy-preserving income ranges instead of exact income values
- Condition-by-condition explanations and missing-information states
- Published documents and application routes for each scheme
- Office finder that routes by office type and printed jurisdiction across Kerala
- Easy Mode: one question per screen, large buttons, questions and answers read aloud with the spoken option highlighted
- Consolidated document checklist that prints or saves as PDF without any personal data
- Recorded Malayalam and English audio clips, with the browser voice as a fallback
- Optional voice-assisted input
- Keyboard, screen-reader, high-contrast, and reduced-motion support
- Browser-based screening with no user account or persistent answer storage

## How it works

```text
Official sources and curated dataset
                │
                ▼
       Dataset validation and build
                │
                ▼
     Three-valued eligibility engine
                │
                ▼
       Adaptive question selection
                │
                ▼
 Results, explanations, documents, offices
```

Scheme rules are represented as data using `all`, `any`, and `not` groups with typed conditions. The rules engine evaluates every condition as `T` (true), `F` (false), or `U` (unknown). Unknown information is never treated as a rejection; the interface reports it as **Needs information**. The same answers and dataset always produce the same result, and no AI model makes eligibility decisions at runtime.

## Technology

- Next.js 16 and React 19
- TypeScript
- Zod for API input validation
- Vitest for automated tests
- ExcelJS and TSX for dataset tooling
- JSON dataset generated from the reviewed workbook

## Getting started

### Requirements

- Node.js
- npm

### Install and run

```bash
npm install
npm run data
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The reviewer dashboard is available at `/review`.

For a production build:

```bash
npm run build
npm start
```

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Start the production server |
| `npm test` | Run the full Vitest suite |
| `npm run data` | Validate the workbook and generate `data/dataset.json` |
| `npm run data:examples` | Generate data including example rows |
| `npm run data:fixture` | Build fixture data for development and tests |
| `npm run i18n:review` | Regenerate the Malayalam review list |
| `npm run audio` | Write the Malayalam and English clip lists and index recorded audio |
| `npm run tts` | Generate missing Malayalam clips with ElevenLabs (`-- --lang en` for English) |

## Data and source governance

The source workbook is maintained at `dataset/anavandi-dataset.xlsx`. `npm run data` validates it before generating `data/dataset.json`. Validation checks duplicate identifiers, fact and operator types, source URLs, exact quotations, scheme conditions, document references, districts, application locations, and required Malayalam text.

Every verified eligibility condition is expected to include an official source, quotation, and locator. Information that cannot yet be verified is labelled as partial or informational rather than presented as a confirmed rule. Current dataset notes are available through `/review`, `docs/sources-needed.md`, and `docs/malayalam-review.md`.

## Accessibility features

### Easy Mode

Chosen on the start screen or from the header. One question per screen, very large buttons, short on-screen text, **Back / Listen again / Continue**, and "I don't know" wherever it is a valid answer. It is a presentation layer only: the same engine picks every question and receives the same answers. The test suite and `/review` check that every sample household gets the same result in both modes.

### Read-aloud with option highlighting

The question and each answer are separate utterances or recorded clips (`lib/a11y/read-sequence.ts`). An answer is highlighted from its own start event to its own end event, so there is no timing guesswork. **Speaking** uses a dashed outline, a speaker icon and a "Reading" label; **selected** uses a solid thick border, a check mark and a "Selected" label, so neither depends on colour. Tapping stops the speech and selects; Continue submits. Without speech, the screen says audio is unavailable and works by tap.

### Document checklist

Documents are merged across the potentially eligible schemes (`lib/checklist.ts`) and each one expands to show which schemes need it. Schemes without a published list show "Official document list not published / not verified". **Print or save as PDF** uses the browser's print dialog with a print-only sheet holding scheme names, documents, where to apply and the disclaimer, and no answers or identity data. **Clear after printing** erases the session.

### Where to apply

The office type comes from each scheme first, then the district office or the office whose printed jurisdiction covers the district (`lib/offices.ts`). Location is requested only when **Find nearest centre** is pressed and never leaves the device. No office has verified coordinates yet, so every office shows "Distance unavailable — official address provided" with Call and Directions links. Districts with no listed Matsyafed office are reported, with the nearest listed offices shown as other-district alternatives.

## Audio clips

`npm run audio` writes `docs/malayalam-audio-clips.csv` and `docs/english-audio-clips.csv` (one row per question, answer and number range the app can ask) and indexes the recorded files in `data/audio-manifest.json`. `npm run tts` generates missing clips with ElevenLabs (Eleven v3 for Malayalam). It reads `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID_ML` / `ELEVENLABS_VOICE_ID_EN` from the shell only, and marks a clip stale if its text later changes. Listen to every clip before a demo.

## API

The stateless screening endpoint is `POST /api/screen`.

```json
{
  "answers": {
    "livelihood": "fishing"
  }
}
```

The response includes scheme statuses, condition results, missing facts, one-step-away guidance, documents, application routes, the next recommended question, and the applicable disclaimer. Requests and responses are not stored by the application, and responses use `Cache-Control: no-store`. Bodies are limited to 100 answers of up to 200 characters, and error messages name the fact but never repeat the submitted value.

## Privacy and safety

The application does not ask for a name, phone number, Aadhaar number, email address, home address, or free-form personal description.

Answers remain in browser memory only. They are not written to the URL or browser storage and are cleared when the user selects **Clear my information**, closes the tab, or remains idle. District detection happens locally in the browser and the coordinates are never stored. Voice input is optional and uses the browser provider's speech service (Chrome sends the audio to Google); this is stated next to every voice button, and tap-based input always remains available.

## Accessibility

Every question can be answered without voice input. The interface includes semantic headings, labelled controls, keyboard navigation, visible focus states, large touch targets, status announcements, Malayalam text support, read-aloud support, and reduced-motion behaviour.

## Project structure

```text
app/                 Next.js routes, pages, API endpoints, and global styles
components/          Guided navigation, Standard and Easy questions, results, details, checklist, and office finder
lib/engine/           Rule evaluation, screening, adaptive questions, and types
lib/data/             Dataset loading, validation, districts, and spreadsheet helpers
lib/i18n/             English/Malayalam strings and display helpers
lib/a11y/             Read-aloud sequencing with per-option start/end events
lib/easy/             Easy Mode options, selection reducer, and Standard/Easy equivalence driver
lib/checklist.ts      Consolidated document checklist
lib/offices.ts        Office routing by type, district, and jurisdiction
data/                 Generated runtime dataset, audio manifest, and recorded clip texts
public/audio/         Recorded Malayalam (ml/) and English (en/) clips
dataset/              Source workbooks
docs/                 Data, source, Malayalam, and architecture notes
scripts/              Dataset, audio, and review tooling
tests/                Engine, dataset, flow, location, and wording tests
```

## Testing

The test suite covers rule evaluation, three-valued logic, threshold boundaries, dataset validation, adaptive question selection, expected household profiles, district locations, user-facing wording, Easy Mode equivalence, read-aloud highlighting, the document checklist, office routing, and the screening API.

```bash
npm test
```

## Responsible AI disclosure

The application does not use AI at runtime. AI-assisted development and dataset drafting were reviewed by the team against cited official sources. Any dataset row awaiting an additional cross-check remains labelled accordingly and is not silently promoted to a verified rule.

## License and project status

This repository was developed for ANAVANDI FutureBuild 2026. Confirm the project’s licensing and deployment terms with the team before redistribution or production use.
