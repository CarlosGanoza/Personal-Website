export const REVIEW_DIMENSIONS = Object.freeze({
  thesis_and_purpose: {
    label: "Purpose",
    description: "A clear central point, motivation, and answer to the application prompt.",
  },
  specificity_and_evidence: {
    label: "Specificity",
    description: "Concrete details, scenes, decisions, and evidence instead of unsupported claims.",
  },
  structure_and_flow: {
    label: "Structure",
    description: "Logical progression, effective paragraph roles, and clear transitions.",
  },
  voice_and_authenticity: {
    label: "Voice",
    description: "A distinctive, credible voice that sounds like the applicant rather than a template.",
  },
  reflection_and_growth: {
    label: "Reflection",
    description: "Insight into why events mattered, what changed, and how the applicant thinks now.",
  },
  clarity_and_style: {
    label: "Clarity",
    description: "Readable sentences, precise wording, useful variation, and controlled mechanics.",
  },
});

export const REVIEW_DIMENSION_KEYS = Object.freeze(Object.keys(REVIEW_DIMENSIONS));

export function rubricForModel(focus = []) {
  const selected = focus.length
    ? REVIEW_DIMENSION_KEYS.filter((dimension) => focus.includes(dimension))
    : REVIEW_DIMENSION_KEYS;

  return selected.map((key) => ({ key, ...REVIEW_DIMENSIONS[key] }));
}
