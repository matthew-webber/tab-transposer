/**
 * Popup or background → content script (via tabs.sendMessage). An omitted
 * `ignoreSixth` keeps the page's current setting.
 */
export type ContentRequest = { type: 'get' } | { type: 'set'; frets: number; ignoreSixth?: boolean };

/** Content script reply to every ContentRequest. */
export interface ContentState {
  frets: number;
  /** Leave the 6th string untransposed. */
  ignoreSixth: boolean;
  blockCount: number;
}

/** Content script → background, whenever the page's transposition changes. */
export interface StateMessage {
  type: 'tab-transposer/state';
  frets: number;
}

export const isStateMessage = (msg: unknown): msg is StateMessage =>
  typeof msg === 'object' && msg !== null && (msg as StateMessage).type === 'tab-transposer/state';
