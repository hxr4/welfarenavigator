# AI assistance: what is implemented and where the line is

The eligibility engine contains no AI. Statuses, conditions, documents and offices come only from `data/dataset.json` through `lib/engine`. The two AI-assisted pieces below sit beside the engine, never inside it, and the app works fully with both switched off.

## 1. Plain-language helper (runtime, optional)

Files: `lib/assist/evidence.ts`, `lib/assist/model.ts`, `app/api/assist/route.ts`, `components/AssistPanel.tsx`.

1. The user opens a scheme and taps one of four fixed questions: what is it, who can get it, which documents, how to apply. There is no free-text box.
2. The browser retrieves that scheme's stored official quotations for the question (structured retrieval by scheme ID; no embeddings, no vector store) and shows them numbered. This step runs offline.
3. Only if `ANTHROPIC_API_KEY` is set on the server and the device is online, a **Say it in simple words** button appears. The request body is `{schemeId, intent, lang}` and nothing else; any extra field, such as household answers, is rejected with 400.
4. The server sends the quotations to the model with instructions to use only those quotes, cite each sentence as `[n]`, copy numbers exactly and never say whether the family qualifies.
5. A grounding guard checks the reply before it is shown: at least one citation, every citation points to a real quote, every number appears in the quotes, no promise wording. If any check fails, the reply is discarded and only the official text is shown.
6. The reply is labelled as machine-written and the official quotes stay directly below it.

Configuration: `ANTHROPIC_API_KEY`, optional `WN_ASSIST_MODEL` (default `claude-opus-5-5`), `WN_ASSIST=off` to disable. Responses are `Cache-Control: no-store` and the handler does not log.

## 2. Rule audit (developer workflow)

`npm run audit:rules` runs deterministic checks on every condition and writes `docs/rule-audit.md`. CI runs it on every push and fails on errors. `npm run audit:rules:ai` adds an advisory second opinion from the model on whether each quotation supports its encoded condition. The model never edits the workbook; a person decides every change.

## Why there is no general chatbot or vector RAG

- Every answer a user needs is already structured data with a source quote, so retrieval is an exact lookup by scheme ID.
- The official corpus is small and partly unreadable (legacy-font Malayalam PDFs, see `sources-needed.md`).
- A free-text box invites people to type personal details.
- Unchecked Malayalam generation cannot be verified overnight; the grounding guard and the always-visible quotes are how the helper stays honest.
