const WORD_PATTERN = /[\p{L}\p{N}'’-]+/gu;

export function normalizeWhitespace(value) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalizedTextWithOffsets(value) {
  const normalizedCharacters = [];
  const offsets = [];
  let previousWasSpace = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const isSpace = /\s/u.test(character);

    if (isSpace) {
      if (!previousWasSpace && normalizedCharacters.length) {
        normalizedCharacters.push(" ");
        offsets.push(index);
      }
      previousWasSpace = true;
      continue;
    }

    normalizedCharacters.push(character.normalize("NFKC").toLocaleLowerCase("en-US"));
    offsets.push(index);
    previousWasSpace = false;
  }

  if (normalizedCharacters.at(-1) === " ") {
    normalizedCharacters.pop();
    offsets.pop();
  }

  return { text: normalizedCharacters.join(""), offsets };
}

export function findGroundedPassages(essay, query, maxResults = 5) {
  const source = normalizedTextWithOffsets(essay);
  const needle = normalizeWhitespace(query).toLocaleLowerCase("en-US");
  if (!needle) return [];

  const matches = [];
  let cursor = 0;

  while (matches.length < maxResults) {
    const normalizedStart = source.text.indexOf(needle, cursor);
    if (normalizedStart === -1) break;

    const normalizedEnd = normalizedStart + needle.length - 1;
    const start = source.offsets[normalizedStart];
    const end = source.offsets[normalizedEnd] + 1;
    const paragraphIndex = essay.slice(0, start).split(/\n\s*\n/u).length - 1;
    const contextStart = Math.max(0, start - 90);
    const contextEnd = Math.min(essay.length, end + 90);

    matches.push({
      quote: essay.slice(start, end),
      start,
      end,
      paragraph: paragraphIndex + 1,
      context: normalizeWhitespace(essay.slice(contextStart, contextEnd)),
    });

    cursor = normalizedStart + Math.max(1, needle.length);
  }

  return matches;
}

export function inspectEssay(essay) {
  const paragraphs = essay
    .split(/\n\s*\n/u)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);

  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  const sentences = [...segmenter.segment(essay)]
    .map(({ segment }) => normalizeWhitespace(segment))
    .filter(Boolean);
  const words = essay.match(WORD_PATTERN) ?? [];

  return {
    characters: essay.length,
    words: words.length,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    estimatedReadingMinutes: Math.max(1, Math.ceil(words.length / 220)),
    structure: paragraphs.map((text, index) => ({
      paragraph: index + 1,
      words: (text.match(WORD_PATTERN) ?? []).length,
      opening: text.slice(0, 180),
    })),
  };
}

function tokenSet(value) {
  return new Set((normalizeWhitespace(value).toLocaleLowerCase("en-US").match(WORD_PATTERN) ?? []));
}

function jaccardSimilarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;

  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function isDuplicateAnnotation(existing, candidate) {
  if (existing.dimension !== candidate.dimension || existing.kind !== candidate.kind) return false;

  const overlapStart = Math.max(existing.anchor.start, candidate.anchor.start);
  const overlapEnd = Math.min(existing.anchor.end, candidate.anchor.end);
  const anchorsOverlap = overlapEnd > overlapStart;
  const explanationSimilarity = jaccardSimilarity(existing.explanation, candidate.explanation);
  const suggestionSimilarity = jaccardSimilarity(existing.suggestion, candidate.suggestion);

  return anchorsOverlap || explanationSimilarity >= 0.68 || suggestionSimilarity >= 0.72;
}
