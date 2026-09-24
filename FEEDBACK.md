# Evaluation feedback log

Each row is a comment we received, what we changed, and the commit that shows it. Rows marked "to fill" are waiting for the judge's words; we do not paraphrase feedback we did not receive.

## Judge rounds

| Round | Feedback | Change made | Commit |
|---|---|---|---|
| 1 | Add an AI component. | Added AI beside the engine, not inside it. (1) A plain-language helper on each scheme page: four fixed questions, official quotes retrieved by scheme ID, optional model rewrite that sends only scheme, question and language, with a grounding guard that discards any reply with an uncited sentence or a number not in the quotes. (2) `npm run audit:rules`, an automated rule check in CI, with an advisory AI second opinion on whether each quote supports its encoded condition. Eligibility is still decided only by the rules. Follow-up: removed the dependency on a paid API. The helper now runs on Chrome's built-in on-device AI, a local Ollama model, or any free-tier OpenAI-compatible provider. After live tests with free 1B and 3B models, AI is barred from rewording eligibility and the guard now rejects uncited sentences and repetition. See `docs/llm-rag.md`. | 187b71c, plus the free-model follow-up |
| 2 | to fill | | |
| 3 (coach) | to fill | | |

## Pre-coding review (23 Sep, before the build)

We wrote a hard critique of our own design before coding. How each major point was answered:

| Review point | Response in the build | Where |
|---|---|---|
| Flat rule schema cannot express OR, nesting, exclusions | Rules are `all` / `any` / `not` trees with typed conditions, validated at build | `lib/engine/types.ts`, `lib/data/validate.ts` |
| Unknown values silently become false | Three-valued T/F/U evaluation; unknown never rejects on its own | `lib/engine/evaluate.ts`, engine tests |
| Asks exact income | Income, age and years are asked as bands cut at the rules' own thresholds | `lib/engine/bands.ts` |
| Single "primary livelihood" | Livelihood is multi-select and includes allied fishery work | `livelihood` fact |
| No "I don't know" | Every question offers I don't know; sensitive ones offer Prefer not to say | question card, Easy Mode |
| Explanations hide the limit | Each condition shows the user's answer, the rule and the official quote with page locator | `SchemeDetail`, `SourceNote` |
| Nothing helps a near-miss household | One-step-away guidance for a single changeable failing condition | `lib/engine/screen.ts` |
| Adaptive = skip logic | The next question is computed from undecided schemes; equivalence test proves adaptive answers give the same result as a full profile | `lib/engine/next-question.ts`, tests |
| Cloud-only, fails on the coach | Engine, rules, both languages, tap input, recorded audio and self-hosted fonts run in the browser; only voice and the optional AI rewrite need internet | `npm run build && npm start` |
| Privacy claim broader than the implementation | Answers stay in tab memory, no URL data, no storage, idle clear, no handler logging, voice disclosure on every mic button | README, Privacy |
| Low literacy ranked last | Easy Mode with recorded Malayalam and English clips and highlighted read-aloud | `components/EasyQuestion.tsx`, `public/audio` |
| Judges may bring their own cases | Reviewer page runs all sample profiles, generated boundary cases and a custom profile, and shows the build commit | `/review` |
| No adoption story | Assisted mode for Akshaya operators and field workers (3-minute idle clear, next-family button); rules maintained as workbook data | start screen, `dataset/` |
| Response to feedback not planned | This file | |

## Open items the tools report

From `docs/rule-audit.md` and `/review` at the time of writing: all 106 encoded conditions still await a second human review; FISH-07 is marked apply-verified with no application route listed; six verified schemes (FISH-03, 04, 05, 08, 09, PLNT-03) have no published document list; interface Malayalam strings are not yet marked reviewed.
