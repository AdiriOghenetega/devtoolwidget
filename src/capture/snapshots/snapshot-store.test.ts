import { describe, expect, it } from 'vitest';
import { toMillis, type SavedSnapshot } from '../../core';
import { createFakeStoragePort } from '../../platform/fakes';
import { SnapshotStore } from './snapshot-store';

function snapshot(
  id: string,
  createdAt: number,
  metrics: Record<string, number> = {},
): SavedSnapshot {
  return { id, label: id, createdAt: toMillis(createdAt), metrics, findings: [] };
}

describe('SnapshotStore', () => {
  it('saves and lists snapshots (newest first)', async () => {
    const store = new SnapshotStore(createFakeStoragePort());
    await store.save(snapshot('a', 1, { health: 90 }));
    await store.save(snapshot('b', 2, { health: 80 }));

    const listed = await store.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.map((entry) => entry.id)).toEqual(['b', 'a']);
      expect(listed.value[0]?.metrics).toEqual({ health: 80 });
    }
  });

  it('applies the retention policy of 20 snapshots', async () => {
    const store = new SnapshotStore(createFakeStoragePort());
    for (let index = 0; index < 25; index += 1) {
      await store.save(snapshot(`s${String(index)}`, index));
    }
    const listed = await store.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(20);
      expect(listed.value.map((entry) => entry.id)).not.toContain('s4');
    }
  });

  it('removes a snapshot by id and clears all', async () => {
    const store = new SnapshotStore(createFakeStoragePort());
    await store.save(snapshot('a', 1));
    await store.save(snapshot('b', 2));

    await store.remove('a');
    const afterRemove = await store.list();
    expect(afterRemove.ok).toBe(true);
    if (afterRemove.ok) {
      expect(afterRemove.value.map((entry) => entry.id)).toEqual(['b']);
    }

    await store.clear();
    const cleared = await store.list();
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.value).toEqual([]);
    }
  });
});
