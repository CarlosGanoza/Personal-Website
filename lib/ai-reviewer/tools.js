import { randomUUID } from "node:crypto";
import { AnnotationInputSchema, FinalizeInputSchema } from "./schema.js";
import { rubricForModel } from "./rubric.js";
import { findGroundedPassages, inspectEssay, isDuplicateAnnotation } from "./text.js";

const json = (value) => JSON.stringify(value);

function strictObject(properties, required = Object.keys(properties)) {
  return { type: "object", properties, required, additionalProperties: false };
}

export function createReviewState(request) {
  return {
    request,
    essayMap: inspectEssay(request.essay),
    inspected: false,
    searches: 0,
    annotations: [],
    finalized: null,
  };
}

function coverageFor(state) {
  const strengths = state.annotations.filter(({ kind }) => kind === "strength").length;
  const improvements = state.annotations.filter(({ kind }) => kind === "improvement").length;
  const dimensions = [...new Set(state.annotations.map(({ dimension }) => dimension))];
  const requiredDimensions = Math.min(3, rubricForModel(state.request.options?.focus).length);

  const missing = [];
  if (!state.inspected) missing.push("inspect the essay");
  if (strengths < 1) missing.push("record at least one grounded strength");
  if (improvements < 2) missing.push("record at least two grounded improvements");
  if (dimensions.length < requiredDimensions) {
    missing.push(`cover at least ${requiredDimensions} rubric dimensions`);
  }

  return {
    annotationCount: state.annotations.length,
    strengths,
    improvements,
    dimensions,
    requiredDimensions,
    readyToFinalize: missing.length === 0,
    missing,
  };
}

function definition(name, description, parameters) {
  return { type: "function", name, description, strict: true, parameters };
}

export function createReviewerTools(state) {
  const activeDimensions = new Set(
    rubricForModel(state.request.options?.focus).map(({ key }) => key),
  );
  const definitions = [
    definition(
      "inspect_essay",
      "Inspect essay statistics, paragraph structure, and the active review rubric. Call this before recording annotations.",
      strictObject({
        mode: {
          type: "string",
          enum: ["overview", "structure", "rubric"],
          description: "The inspection view to return.",
        },
      }),
    ),
    definition(
      "find_passage",
      "Find exact text in the essay and return grounded offsets and context. Use this before recording an annotation.",
      strictObject({
        query: { type: "string", minLength: 3, maxLength: 500 },
        maxResults: { type: "integer", minimum: 1, maximum: 5 },
      }),
    ),
    definition(
      "record_annotation",
      "Record one evidence-backed strength or improvement. The quote must occur in the submitted essay.",
      strictObject({
        quote: { type: "string", minLength: 3, maxLength: 500 },
        dimension: {
          type: "string",
          enum: rubricForModel().map(({ key }) => key),
        },
        kind: { type: "string", enum: ["strength", "improvement"] },
        severity: { type: "string", enum: ["low", "medium", "high"] },
        title: { type: "string", minLength: 3, maxLength: 90 },
        explanation: { type: "string", minLength: 12, maxLength: 700 },
        suggestion: { type: "string", minLength: 8, maxLength: 700 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      }),
    ),
    definition(
      "review_status",
      "Check annotation balance, rubric coverage, and what is still required before finalizing.",
      strictObject({}, []),
    ),
    definition(
      "finalize_review",
      "Finalize the structured review after review_status reports that coverage is ready.",
      strictObject({
        summary: { type: "string", minLength: 30, maxLength: 1000 },
        readerImpression: { type: "string", minLength: 20, maxLength: 700 },
        nextSteps: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: { type: "string", minLength: 8, maxLength: 240 },
        },
        dimensionScores: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: strictObject({
            dimension: {
              type: "string",
              enum: rubricForModel().map(({ key }) => key),
            },
            score: { type: "integer", minimum: 1, maximum: 5 },
            rationale: { type: "string", minLength: 12, maxLength: 500 },
          }),
        },
      }),
    ),
  ];

  async function execute(name, rawArguments) {
    let args;
    try {
      args = typeof rawArguments === "string" ? JSON.parse(rawArguments) : rawArguments;
    } catch {
      return json({ ok: false, error: "Tool arguments were not valid JSON." });
    }

    try {
      if (name === "inspect_essay") {
        state.inspected = true;
        if (args.mode === "rubric") {
          return json({ ok: true, rubric: rubricForModel(state.request.options?.focus) });
        }
        if (args.mode === "structure") {
          return json({ ok: true, structure: state.essayMap.structure });
        }
        return json({
          ok: true,
          stats: { ...state.essayMap, structure: undefined },
          context: state.request.context ?? {},
          rubric: rubricForModel(state.request.options?.focus),
        });
      }

      if (name === "find_passage") {
        state.searches += 1;
        const matches = findGroundedPassages(state.request.essay, args.query, args.maxResults);
        return json({ ok: true, count: matches.length, matches });
      }

      if (name === "record_annotation") {
        if (!state.inspected) {
          return json({ ok: false, error: "Inspect the essay before recording annotations." });
        }

        const annotation = AnnotationInputSchema.parse(args);
        if (!activeDimensions.has(annotation.dimension)) {
          return json({
            ok: false,
            error: "This dimension is outside the active review rubric.",
            activeDimensions: [...activeDimensions],
          });
        }
        const [anchor] = findGroundedPassages(state.request.essay, annotation.quote, 1);
        if (!anchor) {
          return json({
            ok: false,
            error: "The quote is not grounded in the essay. Use find_passage and submit exact source text.",
          });
        }

        const candidate = {
          id: randomUUID(),
          ...annotation,
          quote: anchor.quote,
          anchor: {
            start: anchor.start,
            end: anchor.end,
            paragraph: anchor.paragraph,
          },
        };
        const duplicate = state.annotations.find((existing) => isDuplicateAnnotation(existing, candidate));
        if (duplicate) {
          return json({
            ok: false,
            duplicateOf: duplicate.id,
            error: "This overlaps an existing annotation. Keep the stronger note instead of repeating it.",
          });
        }

        state.annotations.push(candidate);
        return json({ ok: true, annotation: candidate, coverage: coverageFor(state) });
      }

      if (name === "review_status") {
        return json({ ok: true, coverage: coverageFor(state) });
      }

      if (name === "finalize_review") {
        const coverage = coverageFor(state);
        if (!coverage.readyToFinalize) {
          return json({ ok: false, error: "Review coverage is incomplete.", coverage });
        }

        const finalInput = FinalizeInputSchema.parse(args);
        const uniqueScores = new Map(
          finalInput.dimensionScores.map((score) => [score.dimension, score]),
        );
        const outsideRubric = [...uniqueScores.keys()].filter(
          (dimension) => !activeDimensions.has(dimension),
        );
        if (outsideRubric.length) {
          return json({
            ok: false,
            error: "Dimension scores must use only the active review rubric.",
            outsideRubric,
          });
        }
        if (uniqueScores.size < coverage.requiredDimensions) {
          return json({
            ok: false,
            error: `Provide scores for at least ${coverage.requiredDimensions} different dimensions.`,
          });
        }

        state.finalized = {
          ...finalInput,
          dimensionScores: [...uniqueScores.values()],
        };
        return json({ ok: true, finalized: true });
      }

      return json({ ok: false, error: `Unknown tool: ${name}` });
    } catch (error) {
      return json({
        ok: false,
        error: "Tool input failed validation.",
        details: error?.issues?.map((issue) => `${issue.path.join(".")}: ${issue.message}`) ?? [],
      });
    }
  }

  return { definitions, execute, coverage: () => coverageFor(state) };
}
