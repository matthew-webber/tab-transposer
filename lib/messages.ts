/**
 * Popup or background → content script (via tabs.sendMessage). An omitted
 * `ignoreSixth` or `offsets` keeps the page's current setting.
 */
export type ContentRequest =
  | { type: 'get' }
  | { type: 'set'; frets: number; ignoreSixth?: boolean; offsets?: number[] | null };

/** Content script reply to every ContentRequest. */
export interface ContentState {
  frets: number;
  /** Leave the 6th string untransposed. */
  ignoreSixth: boolean;
  /**
   * Extra frets per string on top of `frets`, 1st string first, for a tuning
   * whose strings don't all move the same (e.g. Standard → Drop D). Only
   * applied to staves with that many strings. Null when unused.
   */
  offsets: number[] | null;
  blockCount: number;
}

/** Content script → background, whenever the page's transposition changes. */
export interface StateMessage {
  type: 'tab-transposer/state';
  frets: number;
  offsets: number[] | null;
}

export const isStateMessage = (msg: unknown): msg is StateMessage =>
  typeof msg === 'object' && msg !== null && (msg as StateMessage).type === 'tab-transposer/state';
