/**
 * Text alignment engine for ASR-to-script matching.
 *
 * Uses pinyin-aware character scoring:
 * ASR homophone errors (弥漫 vs 弥望) are handled by comparing
 * pinyin initials/finals instead of exact characters.
 */

import PINYIN_MAP from './pinyin-map';

export interface AlignmentResult {
  charIndex: number; // current position in source script (character index)
  confidence: number; // 0-1
}

const CLEAN_RE = /[\s　]+/g;

function normalize(text: string): string {
  return text.replace(CLEAN_RE, '');
}

/** Get pinyin (without tone) for a Chinese character. Returns '' for non-CJK. */
function getPinyin(ch: string): string {
  const py = PINYIN_MAP[ch];
  if (!py) return '';
  // Strip tone digits (e.g. "mi2" → "mi", "wang4" → "wang")
  return py.replace(/\d+$/, '');
}

/** Extract initial consonant from pinyin (e.g. "zh" from "zhuang"). */
function getInitial(py: string): string {
  const initials = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
  for (const init of initials) {
    if (py.startsWith(init)) return init;
  }
  return '';
}

/** Extract final (vowel part) from pinyin. */
function getFinal(py: string): string {
  return py.replace(/^(zh|ch|sh|[bpmfdtnlgkhjqxrczsyw])/, '');
}

/**
 * Similarity between two pinyin strings. Returns 0-1 (1 = identical).
 * - Same pinyin (homophones): 1.0
 * - Same initial consonant: 0.4
 * - Same final vowel: 0.3
 * - Different: 0
 */
function pinyinSimilarity(py1: string, py2: string): number {
  if (!py1 || !py2) return py1 === py2 ? 1 : 0;
  if (py1 === py2) return 1;

  const ini1 = getInitial(py1);
  const ini2 = getInitial(py2);
  const fin1 = getFinal(py1);
  const fin2 = getFinal(py2);

  if (ini1 === ini2 && fin1 === fin2) return 1;
  if (ini1 === ini2) return 0.4;
  if (fin1 === fin2 && fin1.length > 0) return 0.3;
  return 0;
}

/**
 * Similarity between two characters. Returns 0-1.
 * Uses pinyin for CJK characters, exact match for others.
 */
function charSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const py1 = getPinyin(a);
  const py2 = getPinyin(b);
  if (py1 || py2) return pinyinSimilarity(py1, py2);
  return 0;
}

/**
 * Score how well `needle` matches at position `pos` in `haystack`
 * using pinyin-aware character similarity. Returns 0-1.
 */
function pinyinScore(haystack: string, needle: string, pos: number): number {
  let total = 0;
  let score = 0;
  for (let i = 0; i < needle.length; i++) {
    if (pos + i >= haystack.length) break;
    total++;
    score += charSimilarity(needle[i], haystack[pos + i]);
  }
  return total > 0 ? score / total : 0;
}

/**
 * Find the best match position of `needle` inside `haystack`
 * using pinyin-aware scoring. Searches within a window around `startFrom`.
 */
function fuzzyFind(haystack: string, needle: string, startFrom: number): number {
  if (needle.length === 0) return startFrom;

  // Try exact substring first
  const exactIdx = haystack.indexOf(needle, startFrom);
  if (exactIdx !== -1) return exactIdx;

  // Constrain search range to avoid false matches far from expected position
  const searchStart = Math.max(0, startFrom - needle.length);
  const searchEnd = Math.min(haystack.length - needle.length, startFrom + needle.length * 3);

  let bestIdx = -1;
  let bestScore = 0;

  for (let i = searchStart; i <= searchEnd; i++) {
    const score = pinyinScore(haystack, needle, i);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // Require at least 50% pinyin similarity
  return bestScore >= 0.5 ? bestIdx : -1;
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
