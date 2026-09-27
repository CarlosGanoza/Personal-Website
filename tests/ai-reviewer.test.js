import test from "node:test";
import assert from "node:assert/strict";
import { parseReviewRequest } from "../lib/ai-reviewer/schema.js";
import { findGroundedPassages, inspectEssay } from "../lib/ai-reviewer/text.js";
import { createReviewState, createReviewerTools } from "../lib/ai-reviewer/tools.js";
import { reviewEssay } from "../lib/ai-reviewer/agent.js";

const ESSAY = `When I joined our neighborhood library, the children's room was often empty. I started a Saturday robotics table with four borrowed kits and handwritten instructions.

The first session failed. My directions assumed everyone had built a circuit before, and two students quietly left. I rewrote the activity around questions, paired returning students with newcomers, and learned to treat confusion as information rather than resistance.

By spring, twenty-three students had attended. The number matters less to me than the moment one student taught her younger brother how to debug a loose wire. I want to keep building learning environments where asking for help is treated as a form of curiosity.`;

function request() {
  return parseReviewRequest({
    essay: ESSAY,
    context: { applicationPrompt: "Describe an experience that changed how you lead." },
    options: { audience: "undergraduate" },
  });
}

test("essay inspection returns stable structural statistics", () => {
  const map = inspectEssay(ESSAY);
  assert.equal(map.paragraphs, 3);
  assert.ok(map.words > 80);
  assert.equal(map.structure.length, 3);
});

test("passage lookup grounds normalized whitespace to original offsets", () => {
  const [match] = findGroundedPassages(
    ESSAY,
    "I rewrote the activity around questions, paired returning students with newcomers",
    1,
  );
  assert.ok(match);
  assert.equal(ESSAY.slice(match.start, match.end), match.quote);
  assert.equal(match.paragraph, 2);
});

test("review tools reject invented quotes", async () => {
  const state = createReviewState(request());
  const tools = createReviewerTools(state);
  await tools.execute("inspect_essay", { mode: "overview" });
  const result = JSON.parse(await tools.execute("record_annotation", {
    quote: "I won the national robotics championship.",
    dimension: "specificity_and_evidence",
    kind: "strength",
    severity: "low",
    title: "Concrete evidence",
    explanation: "This would be a concrete outcome if it appeared in the submitted essay.",
    suggestion: "Keep the detail connected to the applicant's actions.",
    confidence: 0.9,
  }));
  assert.equal(result.ok, false);
  assert.match(result.error, /not grounded/i);
});

test("review tools deduplicate overlapping feedback", async () => {
  const state = createReviewState(request());
  const tools = createReviewerTools(state);
  await tools.execute("inspect_essay", { mode: "overview" });

  const base = {
    quote: "The first session failed.",
    dimension: "reflection_and_growth",
    kind: "improvement",
    severity: "medium",
    title: "Develop the turning point",
    explanation: "The failure creates a useful turning point, but its immediate stakes could be more explicit.",
    suggestion: "Add one concise detail showing what the applicant noticed in that moment.",
    confidence: 0.91,
  };

  const first = JSON.parse(await tools.execute("record_annotation", base));
  const duplicate = JSON.parse(await tools.execute("record_annotation", {
    ...base,
    title: "Clarify the turning point",
  }));
  assert.equal(first.ok, true);
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.duplicateOf);
  assert.equal(state.annotations.length, 1);
});

test("finalization requires balanced, multi-dimension coverage", async () => {
  const state = createReviewState(request());
  const tools = createReviewerTools(state);
  await tools.execute("inspect_essay", { mode: "overview" });

  const annotations = [
    {
      quote: "four borrowed kits and handwritten instructions",
      dimension: "specificity_and_evidence",
      kind: "strength",
      severity: "low",
      title: "Specific setup",
      explanation: "The concrete materials make the opening credible and easy to picture.",
      suggestion: "Preserve these compact, observable details throughout the draft.",
      confidence: 0.95,
    },
    {
      quote: "The first session failed.",
      dimension: "structure_and_flow",
      kind: "improvement",
      severity: "medium",
      title: "Slow the turn",
      explanation: "The central setback arrives quickly and could carry more narrative weight.",
      suggestion: "Add one sensory or behavioral detail before explaining the response.",
      confidence: 0.9,
    },
    {
      quote: "learned to treat confusion as information rather than resistance",
      dimension: "reflection_and_growth",
      kind: "improvement",
      severity: "medium",
      title: "Connect insight forward",
      explanation: "The insight is strong but its influence beyond this project remains implicit.",
      suggestion: "Show one later choice that changed because of this leadership lesson.",
      confidence: 0.92,
    },
  ];

  for (const annotation of annotations) {
    const result = JSON.parse(await tools.execute("record_annotation", annotation));
    assert.equal(result.ok, true);
  }

  const status = JSON.parse(await tools.execute("review_status", {}));
  assert.equal(status.coverage.readyToFinalize, true);

  const finalized = JSON.parse(await tools.execute("finalize_review", {
    summary: "The essay has a credible leadership arc and strong concrete details, with room to deepen the turning point and its lasting impact.",
    readerImpression: "A thoughtful builder who learns by observing people and revising systems around their needs.",
    nextSteps: [
      "Deepen the failed first session with one observable detail.",
      "Connect the central insight to a later leadership decision.",
      "Keep the precise details that make the opening memorable.",
    ],
    dimensionScores: [
      { dimension: "specificity_and_evidence", score: 4, rationale: "The draft includes concrete materials, participation numbers, and observable actions." },
      { dimension: "structure_and_flow", score: 4, rationale: "The narrative progresses clearly from attempt to failure, revision, and outcome." },
      { dimension: "reflection_and_growth", score: 3, rationale: "The core insight is compelling but needs one more forward connection." },
    ],
  }));
  assert.equal(finalized.ok, true);
  assert.ok(state.finalized);
});

test("agent orchestration executes tool calls and returns structured output", async () => {
  const toolCall = (name, callId, argumentsObject) => ({
    type: "function_call",
    name,
    call_id: callId,
    arguments: JSON.stringify(argumentsObject),
  });

  const rounds = [
    {
      id: "response_tools",
      output: [
        toolCall("inspect_essay", "inspect", { mode: "overview" }),
        toolCall("record_annotation", "strength", {
          quote: "four borrowed kits and handwritten instructions",
          dimension: "specificity_and_evidence",
          kind: "strength",
          severity: "low",
          title: "Specific setup",
          explanation: "The concrete materials make the opening credible and easy to picture.",
          suggestion: "Preserve these compact, observable details throughout the draft.",
          confidence: 0.95,
        }),
        toolCall("record_annotation", "structure", {
          quote: "The first session failed.",
          dimension: "structure_and_flow",
          kind: "improvement",
          severity: "medium",
          title: "Slow the turn",
          explanation: "The central setback arrives quickly and could carry more narrative weight.",
          suggestion: "Add one sensory or behavioral detail before explaining the response.",
          confidence: 0.9,
        }),
        toolCall("record_annotation", "reflection", {
          quote: "learned to treat confusion as information rather than resistance",
          dimension: "reflection_and_growth",
          kind: "improvement",
          severity: "medium",
          title: "Connect insight forward",
          explanation: "The insight is strong but its influence beyond this project remains implicit.",
          suggestion: "Show one later choice that changed because of this leadership lesson.",
          confidence: 0.92,
        }),
      ],
    },
    {
      id: "response_final",
      output: [
        toolCall("review_status", "status", {}),
        toolCall("finalize_review", "finalize", {
          summary: "The essay has a credible leadership arc and strong concrete details, with room to deepen the turning point and its lasting impact.",
          readerImpression: "A thoughtful builder who learns by observing people and revising systems around their needs.",
          nextSteps: [
            "Deepen the failed first session with one observable detail.",
            "Connect the central insight to a later leadership decision.",
            "Keep the precise details that make the opening memorable.",
          ],
          dimensionScores: [
            { dimension: "specificity_and_evidence", score: 4, rationale: "The draft includes concrete materials, participation numbers, and observable actions." },
            { dimension: "structure_and_flow", score: 4, rationale: "The narrative progresses clearly from attempt to failure, revision, and outcome." },
            { dimension: "reflection_and_growth", score: 3, rationale: "The core insight is compelling but needs one more forward connection." },
          ],
        }),
      ],
    },
  ];
  const capturedRequests = [];
  const client = {
    responses: {
      async create(input) {
        capturedRequests.push(input);
        return rounds.shift();
      },
    },
  };

  const result = await reviewEssay(request(), { client, model: "test-model", maxRounds: 3 });
  assert.equal(result.model, "test-model");
  assert.equal(result.annotations.length, 3);
  assert.equal(result.coverage.strengths, 1);
  assert.equal(result.coverage.improvements, 2);
  assert.equal(result.dimensionScores.length, 3);
  assert.equal(capturedRequests.length, 2);
  assert.ok(
    capturedRequests[1].input.some((item) => item.type === "function_call_output"),
    "the second model turn should receive tool outputs",
  );
});
