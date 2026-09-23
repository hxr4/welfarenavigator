# LLM / RAG decision

Not implemented. The deterministic app is complete without it.

Why:

- Every answer a user needs (why a scheme matched, documents, office) is already structured data with a source quote. Retrieval is an exact lookup by scheme ID, not a search problem.
- The official corpus is small (18 sources) and partly unreadable (legacy-font Malayalam PDFs, see `sources-needed.md`), so a RAG index would mostly contain the same sentences we already show.
- A model writing Malayalam explanations cannot be checked overnight. One wrong sentence undermines the rule that eligibility comes only from cited rules.
- It adds a network dependency and latency to the demo, and a privacy question we do not have today.

If a local model is added later, the safe shape is:

1. The engine decides the scheme and status as today.
2. The page sends only `schemeId` and the user's question text (no household answers) to a local endpoint.
3. The endpoint retrieves only that scheme's stored quotes and source pages, and answers in plain language with the quotes attached.
4. The UI labels the answer as a machine-written explanation and keeps the official quote beside it.
5. If the endpoint is down, the button is hidden. Nothing else changes.
