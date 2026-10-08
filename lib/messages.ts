/** Popup → content script (via tabs.sendMessage). */
export type ContentRequest = { type: 'get' } | { type: 'set'; frets: number };

/** Content script reply to every ContentRequest. */
export interface ContentState {
  frets: number;
  blockCount: number;
}

/** Content script → background, whenever the page's transposition changes. */
export interface StateMessage {
  type: 'tab-transposer/state';
  frets: number;
}

export const isStateMessage = (msg: unknown): msg is StateMessage =>
  typeof msg === 'object' && msg !== null && (msg as StateMessage).type === 'tab-transposer/state';
