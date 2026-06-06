/**
 * Text alignment engine for ASR-to-script matching.
 *
 * Uses bigram (2-char sequence) sliding window matching:
 * Bigrams are robust to single-character ASR errors (homophones)
 * because adjacent pairs usually still match.
 */

export interface AlignmentResult {
  charIndex: number; // current position in source script (character index)
  confidence: number; // 0-1
}

const CLEAN_RE = /[\s　]+/g;

function normalize(text: string): string {
  return text.replace(CLEAN_RE, '');
}

/**
 * Generate bigrams (2-char sliding sequences) from text.
 * "abcdef" → ["ab", "bc", "cd", "de", "ef"]
 */
function bigrams(text: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < text.length - 1; i++) {
    result.push(text.slice(i, i + 2));
  }
  return result;
}

/**
 * Score how well `needle` matches at position `pos` in `haystack`
 * using bigram overlap. Returns 0-1.
 */
function bigramScore(haystack: string, needle: string, pos: number): number {
  let match = 0;
  let total = 0;
  for (let i = 0; i < needle.length - 1; i++) {
    if (pos + i + 1 >= haystack.length) break;
    total++;
    const ng = needle.slice(i, i + 2);
    const hg = haystack.slice(pos + i, pos + i + 2);
    if (ng === hg) match++;
  }
  return total > 0 ? match / total : 0;
}

/**
 * Find the best match position of `needle` inside `haystack`
 * using bigram scoring. Searches within a window around `startFrom`
 * to avoid false matches at distant positions.
 */
function fuzzyFind(haystack: string, needle: string, startFrom: number): number {
  if (needle.length === 0) return startFrom;

  // Try exact substring first
  const exactIdx = haystack.indexOf(needle, startFrom);
  if (exactIdx !== -1) return exactIdx;

  // Bigram sliding window search
  // Constrain search range to avoid false matches far from expected position
  const searchStart = Math.max(0, startFrom - needle.length);
  const searchEnd = Math.min(haystack.length - needle.length, startFrom + needle.length * 3);

  let bestIdx = -1;
  let bestScore = 0;

  for (let i = searchStart; i <= searchEnd; i++) {
    const score = bigramScore(haystack, needle, i);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // Require at least 60% bigram overlap
  return bestScore >= 0.6 ? bestIdx : -1;
}

/**
 * Align recognized ASR text to the source script.
 *
 * @param sourceScript - Full script text (raw, with spaces/punctuation)
 * @param recognizedText - Accumulated ASR recognized text so far
 * @param lastPosition - Last known position in source script (optimization)
 * @returns Alignment result with char index and confidence
 */
export function alignText(
  sourceScript: string,
  recognizedText: string,
  lastPosition: number = 0,
): AlignmentResult {
  const normSource = normalize(sourceScript);
  const normRecognized = normalize(recognizedText);

  if (normRecognized.length === 0) {
    return { charIndex: 0, confidence: 0 };
  }

  // Use the last N characters of recognized text as the search needle
  // Longer needle = more context = better matching with ASR errors
  const needleLen = Math.min(normRecognized.length, 80);
  const needle = normRecognized.slice(-needleLen);

  // Search in normalized source starting from approximate last position
  const searchStart = Math.max(0, lastPosition - needleLen);
  const normPos = fuzzyFind(normSource, needle, searchStart);

  if (normPos === -1) {
    // Couldn't find a match; return last known position
    return { charIndex: lastPosition, confidence: 0.1 };
  }

  // Map normalized position back to original source position
  // by counting characters
  let originalIdx = 0;
  let normIdx = 0;
  while (normIdx < normPos && originalIdx < sourceScript.length) {
    const ch = sourceScript[originalIdx];
    if (!CLEAN_RE.test(ch)) {
      normIdx++;
    }
    originalIdx++;
  }

  const confidence = Math.min(1, needleLen / 30);
  return { charIndex: originalIdx, confidence };
}
