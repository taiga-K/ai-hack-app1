import type { Utterance } from "@/entities/utterance";

// Longer than mind-map PCM silence (1000ms) and STT turn commit (800ms).
// Those cuts are analysis units, not memo rows.
export const DISPLAY_UTTERANCE_GAP_MS = 3000;

export function joinDisplayUtteranceText(left: string, right: string): string {
  const head = left.trim();
  const tail = right.trim();
  if (head.length === 0) {
    return tail;
  }
  if (tail.length === 0) {
    return head;
  }
  if (needsAsciiSpace(head, tail)) {
    return `${head} ${tail}`;
  }
  return `${head}${tail}`;
}

export function groupUtterancesForDisplay(
  utterances: readonly Utterance[]
): Utterance[] {
  if (utterances.length === 0) {
    return [];
  }

  const ordered = [...utterances].sort(
    (left, right) => left.startMs - right.startMs
  );
  const groups: Utterance[] = [];

  for (const item of ordered) {
    const current = groups.at(-1);
    if (current !== undefined && canContinueDisplayUtterance(current, item)) {
      groups[groups.length - 1] = mergeDisplayUtterance(current, item);
      continue;
    }
    groups.push({ ...item, text: item.text.trim() });
  }

  return groups;
}

function canContinueDisplayUtterance(
  current: Utterance,
  incoming: Utterance
): boolean {
  if (current.speaker !== incoming.speaker) {
    return false;
  }
  return incoming.startMs - current.endMs <= DISPLAY_UTTERANCE_GAP_MS;
}

function mergeDisplayUtterance(
  current: Utterance,
  incoming: Utterance
): Utterance {
  return {
    ...current,
    text: joinDisplayUtteranceText(current.text, incoming.text),
    endMs: Math.max(current.endMs, incoming.endMs),
    isFinal: current.isFinal && incoming.isFinal,
  };
}

function needsAsciiSpace(left: string, right: string): boolean {
  const last = left.at(-1);
  const first = right.at(0);
  if (last === undefined || first === undefined) {
    return false;
  }
  return isAsciiTokenChar(last) && isAsciiTokenChar(first);
}

function isAsciiTokenChar(character: string): boolean {
  return /[A-Za-z0-9]/.test(character);
}
