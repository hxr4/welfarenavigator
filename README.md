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
- District office finder for Kerala
- Optional read-aloud and voice-assisted input
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
| `npm run audio` | List Malayalam clips and index recorded audio |

## Data and source governance

The source workbook is maintained at `dataset/anavandi-dataset.xlsx`. `npm run data` validates it before generating `data/dataset.json`. Validation checks duplicate identifiers, fact and operator types, source URLs, exact quotations, scheme conditions, document references, districts, application locations, and required Malayalam text.

Every verified eligibility condition is expected to include an official source, quotation, and locator. Information that cannot yet be verified is labelled as partial or informational rather than presented as a confirmed rule. Current dataset notes are available through `/review`, `docs/sources-needed.md`, and `docs/malayalam-review.md`.

## API

The stateless screening endpoint is `POST /api/screen`.

```json
{
  "answers": {
    "livelihood": "fishing"
  }
}
```

The response includes scheme statuses, condition results, missing facts, one-step-away guidance, documents, application routes, the next recommended question, and the applicable disclaimer. Requests and responses are not stored by the application, and responses use `Cache-Control: no-store`.

## Privacy and safety

The application does not ask for a name, phone number, Aadhaar number, email address, home address, or free-form personal description.

Answers remain in browser memory only. They are not written to the URL or browser storage and are cleared when the user selects **Clear my information**, closes the tab, or remains idle. District detection happens locally in the browser. Voice input is optional and may use the browser provider’s speech service; tap-based input always remains available.

## Accessibility

Every question can be answered without voice input. The interface includes semantic headings, labelled controls, keyboard navigation, visible focus states, large touch targets, status announcements, Malayalam text support, read-aloud support, and reduced-motion behaviour.

## Project structure

```text
app/                 Next.js routes, pages, API endpoints, and global styles
components/          Guided navigation, questions, results, details, and office finder
lib/engine/           Rule evaluation, screening, adaptive questions, and types
lib/data/             Dataset loading, validation, districts, and spreadsheet helpers
lib/i18n/             English/Malayalam strings and display helpers
data/                 Generated runtime dataset and audio manifest
dataset/              Source workbooks
docs/                 Data, source, Malayalam, and architecture notes
scripts/              Dataset, audio, and review tooling
tests/                Engine, dataset, flow, location, and wording tests
```

## Testing

The test suite covers rule evaluation, three-valued logic, threshold boundaries, dataset validation, adaptive question selection, expected household profiles, district locations, and user-facing wording.

```bash
npm test
```

## Responsible AI disclosure

The application does not use AI at runtime. AI-assisted development and dataset drafting were reviewed by the team against cited official sources. Any dataset row awaiting an additional cross-check remains labelled accordingly and is not silently promoted to a verified rule.

## License and project status

This repository was developed for ANAVANDI FutureBuild 2026. Confirm the project’s licensing and deployment terms with the team before redistribution or production use.
