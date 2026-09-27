# DinoApply AI reviewer foundation

This repository now contains the server-side foundation for an evidence-grounded application essay reviewer. The existing portfolio frontend is unchanged.

## What is included

- A bounded tool-calling agent loop using the OpenAI Responses API.
- Deterministic essay inspection and exact passage lookup.
- Grounded annotations with source offsets and paragraph numbers.
- Rubric coverage, strength/improvement balance, and semantic deduplication.
- Structured final output for a future DinoApply review interface.
- Request validation, an essay-size limit, basic rate limiting, and server-only credentials.
- Unit tests that do not call the OpenAI API.

## Agent tools

1. `inspect_essay` — returns structure, statistics, context, or the active rubric.
2. `find_passage` — locates exact source text and returns offsets plus nearby context.
3. `record_annotation` — records only source-grounded, schema-valid feedback.
4. `review_status` — reports missing balance or rubric coverage.
5. `finalize_review` — creates a structured review only after coverage requirements pass.

The model never receives filesystem, shell, database, email, or arbitrary network tools.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local`. Keep it server-side. Choose an available model with `OPENAI_REVIEW_MODEL`.

Run deterministic tests:

```bash
npm test
```

The Vercel-compatible endpoint is:

```text
POST /api/review
Content-Type: application/json
```

Example request:

```json
{
  "essay": "A complete application essay of at least 120 characters...",
  "context": {
    "applicationPrompt": "Describe an experience that changed how you lead.",
    "targetPrograms": ["Example University"]
  },
  "options": {
    "audience": "undergraduate",
    "focus": ["specificity_and_evidence", "reflection_and_growth", "clarity_and_style"]
  }
}
```

## Next product step

Connect a private DinoApply review screen to `/api/review`, render annotations against the source offsets, and collect accept/dismiss/edit feedback for evaluation. Do not call OpenAI directly from browser JavaScript.
