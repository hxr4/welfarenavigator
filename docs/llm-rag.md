# AI assistance: what is implemented and where the line is

The eligibility engine contains no AI. Statuses, conditions, documents and offices come only from `data/dataset.json` through `lib/engine`. The AI-assisted pieces below sit beside the engine, never inside it, and the app works fully with all of them switched off.

## 1. Plain-language helper (runtime, optional, free options)

Files: `lib/assist/evidence.ts`, `lib/assist/browser.ts`, `lib/assist/model.ts`, `app/api/assist/route.ts`, `components/AssistPanel.tsx`.

1. On a scheme page the user taps one of four fixed questions: what is it, who can get it, which documents, how to apply. There is no free-text box.
2. The browser retrieves that scheme's stored official quotations (structured retrieval by scheme ID; no embeddings) and shows them numbered. This runs offline.
3. For **what / documents / apply** a **Say it in simple words** button appears when a model is available. **Who can get it** never goes to a model: eligibility is shown only in the official words.
4. The model gets only the quotations and the question, never household answers. It must cite a quote for every sentence and copy numbers exactly.
5. A grounding guard checks every reply before it is shown: every sentence cited, every citation real, every number present in the quotes, at most five sentences, no repetition, no promise wording. On any failure the reply is discarded and only the official text is shown.
6. The reply is labelled machine-written, and the official quotes stay directly below it.

### Which model runs it (all optional, first match wins)

| Option | Cost | Key | Data leaves the device? | How to turn on |
|---|---|---|---|---|
| Chrome built-in AI (Gemini Nano, Prompt API) | Free | None | No | Automatic in desktop Chrome 148+ where the device supports it; first use downloads the model |
| Ollama on the host machine | Free | None | No (localhost) | `ollama pull gemma3:4b`, then run the app with `WN_ASSIST_PROVIDER=ollama` |
| Any OpenAI-compatible free tier, e.g. Google AI Studio (Gemini) | Free tier | Free key, no card | Official quotes only | `WN_ASSIST_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `WN_ASSIST_MODEL=<a current Flash model>`, `WN_ASSIST_API_KEY=<key>` |
| Anthropic | Paid | Yes | Official quotes only | `ANTHROPIC_API_KEY` |

`WN_ASSIST=off` disables the server options. Free hosted tiers may use prompts to improve their models; the prompts here contain only public official text.

### What we measured

We ran the live pipeline against free local models on a 1-CPU machine:

| Model | Question | Result |
|---|---|---|
| gemma3:1b | who can get it | Rejected by the guard: copied page numbers, contradictory ages |
| gemma3:1b | who can get it (tighter prompt) | Rejected: invented "21 years", not in any quote |
| qwen2.5:3b | who can get it | **Passed the guard but was wrong** about who qualifies |
| qwen2.5:3b | which documents | Rejected: misread Malayalam quotes, repeated itself |

Conclusions: the guard catches invented numbers and rambling, but cannot catch a plausible misreading. That is why eligibility is never sent to a model, why the quotes always stay on screen, and why we recommend at least a 4B local model or a hosted Flash-class model for the helper. Small models are weak at reading official Malayalam.

## 2. Rule audit (developer workflow)

`npm run audit:rules` runs deterministic checks on every condition and writes `docs/rule-audit.md`; CI runs it on every push. `npm run audit:rules:ai` adds an advisory model opinion on whether each quotation supports its encoded condition, using any of the providers above (Ollama works offline and free). The model never edits the workbook; a person decides every change.

## Why there is no general chatbot or vector RAG

- Every answer a user needs is already structured data with a source quote, so retrieval is an exact lookup by scheme ID.
- The official corpus is small and partly unreadable (legacy-font Malayalam PDFs, see `sources-needed.md`).
- A free-text box invites people to type personal details.
- Unchecked Malayalam generation cannot be verified; the guard, the eligibility block and the always-visible quotes keep the helper honest.
