import { describe, expect, it } from 'vitest';
import { parsePanelMessage, type PanelMessage } from '../../protocol';
import { createPanelFeed, MAX_BUFFERED_DELTAS } from './panel-feed';

/** Builds a validated panel message from a raw fixture (no unchecked casts). */
function message(raw: unknown): PanelMessage {
  const parsed = parsePanelMessage(raw);
  if (!parsed.ok) {
    throw new Error(`Invalid panel-message fixture: ${raw === null ? 'null' : typeof raw}`);
  }
  return parsed.value;
}

function snapshot(correlationId: string): PanelMessage {
  return message({
    type: 'panel.snapshot',
    version: 1,
    correlationId,
    payload: {
      tabId: 1,
      url: '',
      capturedAt: 0,
      console: [],
      network: [],
      vitals: [],
      longTasks: [],
      storage: { areas: [] },
    },
  });
}

function delta(correlationId: string): PanelMessage {
  return message({
    type: 'panel.delta',
    version: 1,
    correlationId,
    payload: {
      at: 1,
      channel: 'console',
      entry: {
        id: correlationId,
        kind: 'console',
        level: 'error',
        timestamp: 1,
        args: [{ type: 'string', value: 'boom' }],
        count: 1,
      },
    },
  });
}

describe('createPanelFeed', () => {
  it('replays the buffered snapshot then deltas on attach', () => {
    const feed = createPanelFeed();
    const received: string[] = [];
    feed.push(snapshot('s1'));
    feed.push(delta('d1'));
    feed.push(delta('d2'));

    feed.attach({
      onMessage: (entry) => {
        received.push(entry.correlationId);
      },
      onConnection: () => undefined,
    });

    expect(received).toEqual(['s1', 'd1', 'd2']);
  });

  it('streams live to the attached handler instead of buffering', () => {
    const feed = createPanelFeed();
    const received: string[] = [];
    feed.attach({
      onMessage: (entry) => {
        received.push(entry.correlationId);
      },
      onConnection: () => undefined,
    });
    feed.push(delta('live'));
    expect(received).toEqual(['live']);
  });

  it('delivers the current connection state on attach and on change', () => {
    const feed = createPanelFeed();
    const states: boolean[] = [];
    feed.setConnected(false);
    feed.attach({
      onMessage: () => undefined,
      onConnection: (connected) => {
        states.push(connected);
      },
    });
    feed.setConnected(true);
    expect(states).toEqual([false, true]);
  });

  it('bounds buffered deltas so a long-lived page cannot grow memory unbounded', () => {
    const feed = createPanelFeed();
    const received: string[] = [];
    for (let index = 0; index < MAX_BUFFERED_DELTAS + 5; index += 1) {
      feed.push(delta(`d${String(index)}`));
    }
    feed.attach({
      onMessage: (entry) => {
        received.push(entry.correlationId);
      },
      onConnection: () => undefined,
    });
    expect(received).toHaveLength(MAX_BUFFERED_DELTAS);
    // The oldest deltas are dropped, the newest are kept.
    expect(received[0]).toBe('d5');
    expect(received.at(-1)).toBe(`d${String(MAX_BUFFERED_DELTAS + 4)}`);
  });
});
