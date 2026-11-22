// Riff (the tab library app) can tell us the tuning the player is in and the
// tuning a saved tab is written in, so tabs open already transposed.
//
// This needs host access to every site (to inject into tab pages without a
// click), so it's opt-in from the popup as an optional permission. That access
// also covers Riff's loopback API.

import { splitShifts } from './steps';

export const RIFF_API = 'http://127.0.0.1:47813/api';
export const PAGE_ORIGINS = ['http://*/*', 'https://*/*'];

/** Riff's GET /api/transpose reply. */
export interface RiffTranspose {
  /** The tuning set in Riff's sidebar ("Tuned to …"), or null when off. */
  playTuning: string | null;
  /** The saved tab for this URL, or null when it isn't in the library. */
  tab: { title: string; artist: string; tuning: string | null } | null;
  /** Frets to shift every string (positive = up), when they all move the same amount. */
  frets: number | null;
  /**
   * Frets to shift each string, 1st (high) string first, e.g. [0,0,0,0,0,2]
   * for a Standard tab played in Drop D. Null when there's nothing to do or
   * the tunings can't be matched. Missing from Riff versions before this.
   */
  strings?: number[] | null;
}

export const hasRiffAccess = () => browser.permissions.contains({ origins: PAGE_ORIGINS });

/** Must be called from a user gesture (a click in the popup). */
export const requestRiffAccess = () => browser.permissions.request({ origins: PAGE_ORIGINS });

export const dropRiffAccess = () => browser.permissions.remove({ origins: PAGE_ORIGINS });

/** The shift Riff asks for, split like the content script's state. Null when nothing moves. */
export function riffShift(riff: RiffTranspose | null): { frets: number; offsets: number[] | null } | null {
  const shifts = riff?.strings ?? (riff?.frets != null ? [riff.frets] : null);
  if (!shifts || !riff?.tab?.tuning) return null;
  const split = splitShifts(shifts);
  return split.frets || split.offsets ? split : null;
}

/** Asks Riff how to transpose `url`. Null if Riff isn't running or didn't answer. */
export async function askRiff(url: string): Promise<RiffTranspose | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(`${RIFF_API}/transpose?url=${encodeURIComponent(url)}`, {
      signal: ctrl.signal,
      // Riff only answers extensions that send this header.
      headers: { 'X-Riff-Client': 'tab-transposer' },
    });
    return res.ok ? ((await res.json()) as RiffTranspose) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Popup line describing what Riff asked for on this page. */
export function riffSummary(riff: RiffTranspose | null): string {
  if (!riff) return 'Riff isn’t running.';
  if (!riff.playTuning) return 'Following Riff. No tuning set in Riff.';
  const from = riff.tab?.tuning;
  if (!from) return `Following Riff: tuned to ${riff.playTuning}.`;
  if (riff.frets == null && !riff.strings) return `Riff: can’t match ${from} to ${riff.playTuning}.`;
  if (from === riff.playTuning) return `Riff: already in ${from}.`;
  return `Riff: ${from} → ${riff.playTuning}`;
}
