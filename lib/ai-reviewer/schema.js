import { z } from "zod";
import { REVIEW_DIMENSION_KEYS } from "./rubric.js";

export const ReviewDimensionSchema = z.enum(REVIEW_DIMENSION_KEYS);
export const AnnotationKindSchema = z.enum(["strength", "improvement"]);
export const SeveritySchema = z.enum(["low", "medium", "high"]);

const ContextSchema = z
  .object({
    applicationPrompt: z.string().trim().max(1500).optional(),
    targetPrograms: z.array(z.string().trim().min(1).max(120)).max(12).optional(),
    applicantGoals: z.string().trim().max(1200).optional(),
  })
  .strict();

const OptionsSchema = z
  .object({
    focus: z.array(ReviewDimensionSchema).max(REVIEW_DIMENSION_KEYS.length).optional(),
    audience: z.enum(["undergraduate", "graduate", "scholarship", "general"]).optional(),
  })
  .strict();

export const ReviewRequestSchema = z
  .object({
    essay: z.string().trim().min(120).max(12000),
    context: ContextSchema.optional(),
    options: OptionsSchema.optional(),
  })
  .strict();

export const AnnotationInputSchema = z
  .object({
    quote: z.string().trim().min(3).max(500),
    dimension: ReviewDimensionSchema,
    kind: AnnotationKindSchema,
    severity: SeveritySchema,
    title: z.string().trim().min(3).max(90),
    explanation: z.string().trim().min(12).max(700),
    suggestion: z.string().trim().min(8).max(700),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const DimensionScoreSchema = z
  .object({
    dimension: ReviewDimensionSchema,
    score: z.number().int().min(1).max(5),
    rationale: z.string().trim().min(12).max(500),
  })
  .strict();

export const FinalizeInputSchema = z
  .object({
    summary: z.string().trim().min(30).max(1000),
    readerImpression: z.string().trim().min(20).max(700),
    nextSteps: z.array(z.string().trim().min(8).max(240)).min(3).max(5),
    dimensionScores: z.array(DimensionScoreSchema).min(3).max(REVIEW_DIMENSION_KEYS.length),
  })
  .strict();

export function parseReviewRequest(input) {
  return ReviewRequestSchema.parse(input);
}

export function formatValidationError(error) {
  if (!(error instanceof z.ZodError)) return "Invalid review request.";

  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "request";
    return `${path}: ${issue.message}`;
  });
}
