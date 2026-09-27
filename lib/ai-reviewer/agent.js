import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import { createReviewState, createReviewerTools } from "./tools.js";
import { parseReviewRequest } from "./schema.js";
import { reviewerInput, reviewerInstructions } from "./prompt.js";

const DEFAULT_MAX_ROUNDS = 8;
const DEFAULT_MAX_OUTPUT_TOKENS = 3500;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildReviewResult(state, model, responseId) {
  if (!state.finalized) throw new Error("Cannot build a review before finalization.");

  return {
    version: "2026-09-19",
    reviewId: responseId,
    generatedAt: new Date().toISOString(),
    model,
    essay: {
      words: state.essayMap.words,
      sentences: state.essayMap.sentences,
      paragraphs: state.essayMap.paragraphs,
    },
    summary: state.finalized.summary,
    readerImpression: state.finalized.readerImpression,
    annotations: state.annotations,
    dimensionScores: state.finalized.dimensionScores,
    nextSteps: state.finalized.nextSteps,
    coverage: {
      dimensions: [...new Set(state.annotations.map(({ dimension }) => dimension))],
      strengths: state.annotations.filter(({ kind }) => kind === "strength").length,
      improvements: state.annotations.filter(({ kind }) => kind === "improvement").length,
    },
  };
}

export async function reviewEssay(rawRequest, options = {}) {
  const request = parseReviewRequest(rawRequest);
  const model = options.model ?? process.env.OPENAI_REVIEW_MODEL ?? "gpt-5.4-mini";
  const maxRounds = positiveInteger(
    options.maxRounds ?? process.env.AI_REVIEW_MAX_TOOL_ROUNDS,
    DEFAULT_MAX_ROUNDS,
  );
  const maxOutputTokens = positiveInteger(
    options.maxOutputTokens ?? process.env.AI_REVIEW_MAX_OUTPUT_TOKENS,
    DEFAULT_MAX_OUTPUT_TOKENS,
  );
  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const state = createReviewState(request);
  const tools = createReviewerTools(state);
  const input = [{ role: "user", content: reviewerInput(request) }];
  let lastResponseId = null;

  for (let round = 0; round < maxRounds; round += 1) {
    const response = await client.responses.create({
      model,
      instructions: reviewerInstructions(request),
      input,
      tools: tools.definitions,
      tool_choice: "auto",
      parallel_tool_calls: true,
      max_output_tokens: maxOutputTokens,
      store: false,
    });
    lastResponseId = response.id;
    input.push(...toResponseInputItems(response.output));

    const calls = response.output.filter((item) => item.type === "function_call");
    if (!calls.length) {
      input.push({
        role: "user",
        content: "Continue the review using the provided tools. Finalize only after review_status is ready.",
      });
      continue;
    }

    for (const call of calls) {
      const output = await tools.execute(call.name, call.arguments);
      input.push({ type: "function_call_output", call_id: call.call_id, output });
    }

    if (state.finalized) return buildReviewResult(state, model, lastResponseId);
  }

  const error = new Error("The reviewer did not finalize within the configured tool-round limit.");
  error.code = "REVIEW_NOT_FINALIZED";
  error.coverage = tools.coverage();
  throw error;
}
