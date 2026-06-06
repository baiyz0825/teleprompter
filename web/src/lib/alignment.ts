/**
 * Text alignment engine for ASR-to-script matching.
 *
 * Uses a sliding window + anchor strategy:
 * 1. Find longest common subsequence anchors in recognized text
 * 2. Use anchors to estimate position in the source script
 * 3. Fine-tune with character-level resync around anchors
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
 * Find the best match position of `needle` inside `haystack`.
 * Returns the start index in haystack, or -1 if not found.
 */
function fuzzyFind(haystack: string, needle: string, startFrom: number): number {
  if (needle.length === 0) return startFrom;

  // Try exact substring first
  const exactIdx = haystack.indexOf(needle, startFrom);
  if (exactIdx !== -1) return exactIdx;

  // Try sliding window with character overlap scoring
  let bestIdx = -1;
  let bestScore = 0;
  const windowSize = needle.length;

  for (let i = startFrom; i <= haystack.length - windowSize; i += 1) {
    let score = 0;
    for (let j = 0; j < windowSize; j++) {
      if (haystack[i + j] === needle[j]) score++;
    }
    const ratio = score / windowSize;
    if (ratio > bestScore && ratio >= 0.5) {
      bestScore = ratio;
      bestIdx = i;
    }
  }

  return bestIdx;
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
  // to handle incremental recognition
  const needleLen = Math.min(normRecognized.length, 40);
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

  const confidence = Math.min(1, needleLen / 20);
  return { charIndex: originalIdx, confidence };
}
