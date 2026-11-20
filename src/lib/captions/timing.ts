import type { CaptionMode, Word } from "@/lib/captions/types";

export type Cue = {
  id: string;
  start: number;
  end: number;
  words: Word[];
};

export function uid(): string {
  return crypto.randomUUID();
}

export function buildCues(words: Word[], wordsPerCue: number): Cue[] {
  const cues: Cue[] = [];
  let bucket: Word[] = [];
  const limit = Math.max(1, Math.round(wordsPerCue));
  const flush = () => {
    if (!bucket.length) return;
    cues.push({
      id: bucket.map((word) => word.id).join("."),
      start: bucket[0].start,
      end: bucket[bucket.length - 1].end,
      words: bucket,
    });
    bucket = [];
  };
  for (const word of words) {
    bucket.push(word);
    if (bucket.length >= limit || word.breakAfter) flush();
  }
  flush();
  return cues;
}

export function activeWord(words: Word[], time: number): Word | null {
  return words.find((word) => time >= word.start && time < word.end) ?? null;
}

export function cueAt(words: Word[], time: number, wordsPerCue: number, mode: CaptionMode): Cue | null {
  if (!words.length) return null;
  if (mode === "single") {
    const hit = activeWord(words, time);
    const word =
      hit ??
      [...words].reverse().find((item) => item.end <= time && time - item.end < 0.16) ??
      null;
    if (!word) return null;
    return { id: word.id, start: word.start, end: word.end, words: [word] };
  }
  const cues = buildCues(words, wordsPerCue);
  const direct = cues.find((cue) => time >= cue.start - 0.02 && time <= cue.end + 0.03);
  if (direct) return direct;
  return [...cues].reverse().find((cue) => cue.end < time && time - cue.end < 0.2) ?? null;
}

export function projectSpan(words: Word[], mediaDuration: number | null): number {
  const wordEnd = words.reduce((max, word) => Math.max(max, word.end), 0);
  if (mediaDuration && mediaDuration > 0) return Math.max(mediaDuration, 0.1);
  return Math.max(wordEnd + 0.4, 8);
}

export function wordsFromScript(text: string, duration: number): Word[] {
  const tokens = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!tokens.length) return [];
  const weights = tokens.map((token) => {
    const clean = token.replace(/[.,!?;:۔،]/g, "");
    return Math.max(1, clean.length) + (/[.,!?۔]/.test(token) ? 6 : 0);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const span = Math.max(duration, tokens.length * 0.28);
  let cursor = 0;
  return tokens.map((token, index) => {
    const start = (cursor / total) * span;
    cursor += weights[index] ?? 1;
    const end = (cursor / total) * span;
    return {
      id: uid(),
      text: token,
      start: round(start),
      end: round(Math.max(end, start + 0.08)),
    };
  });
}

export function fitWords(words: Word[], duration: number): Word[] {
  if (!words.length) return words;
  const end = Math.max(...words.map((word) => word.end), 0.01);
  const scale = duration / end;
  return words.map((word) => ({
    ...word,
    start: round(Math.max(0, word.start * scale)),
    end: round(Math.max(word.start * scale + 0.05, word.end * scale)),
  }));
}

export function shiftWords(words: Word[], delta: number): Word[] {
  return words.map((word) => ({
    ...word,
    start: round(Math.max(0, word.start + delta)),
    end: round(Math.max(0.05, word.end + delta)),
  }));
}

export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) value = 0;
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const tenths = Math.floor((value - total) * 10);
  return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

export function displayText(text: string, uppercase: boolean): string {
  return uppercase ? text.toUpperCase() : text;
}

export function lipSyncWords(words: Word[], peaks: number[], duration: number): Word[] {
  if (!words.length) return words;
  const last = words[words.length - 1]?.end ?? 0;
  const span = Math.max(duration, last, 0.4);
  const onsets = energyOnsets(peaks, span);
  if (onsets.length >= Math.min(words.length, 6)) {
    const marks = monotonic(sampleMarks(onsets, words.length, span));
    return words.map((word, index) => {
      const start = Math.max(0, marks[index] - 0.04);
      const next = index + 1 < marks.length ? marks[index + 1] : span;
      const natural = Math.max(0.09, Math.min(0.55, word.end - word.start || 0.22));
      const end = Math.min(Math.max(start + natural, start + 0.08), Math.max(start + 0.08, next - 0.02));
      return { ...word, start: round(start), end: round(Math.max(end, start + 0.08)) };
    });
  }
  return tightenLead(words);
}

function tightenLead(words: Word[]): Word[] {
  let prevEnd = 0;
  return words.map((word) => {
    const dur = Math.max(0.08, word.end - word.start);
    let start = Math.max(0, word.start - 0.045);
    if (start < prevEnd) start = prevEnd;
    const end = start + dur;
    prevEnd = end;
    return { ...word, start: round(start), end: round(end) };
  });
}

function energyOnsets(peaks: number[], span: number): number[] {
  if (peaks.length < 8) return [];
  const sorted = [...peaks].sort((a, b) => a - b);
  const thresh = sorted[Math.floor(sorted.length * 0.62)] || 0.08;
  const onsets: number[] = [];
  for (let index = 2; index < peaks.length; index += 1) {
    const prev = peaks[index - 1] ?? 0;
    const value = peaks[index] ?? 0;
    if (value >= thresh && value > prev * 1.25 && value > (peaks[index - 2] ?? 0)) {
      const time = (index / peaks.length) * span;
      if (!onsets.length || time - onsets[onsets.length - 1] > 0.09) onsets.push(time);
    }
  }
  return onsets;
}

function sampleMarks(onsets: number[], count: number, span: number): number[] {
  if (onsets.length === count) return onsets;
  if (onsets.length > count) {
    return Array.from({ length: count }, (_, index) => {
      const pick = Math.round((index * (onsets.length - 1)) / Math.max(1, count - 1));
      return onsets[pick] ?? 0;
    });
  }
  return Array.from({ length: count }, (_, index) => {
    const target = (index / count) * span * 0.92 + 0.05;
    let best = onsets[0] ?? target;
    let dist = Infinity;
    for (const onset of onsets) {
      const delta = Math.abs(onset - target);
      if (delta < dist) {
        dist = delta;
        best = onset;
      }
    }
    return dist < 0.18 ? best : target;
  });
}

function monotonic(marks: number[]): number[] {
  let last = 0;
  return marks.map((mark) => {
    const value = Math.max(mark, last + 0.08);
    last = value;
    return value;
  });
}
