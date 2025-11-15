import cache, { setBackend, makeCacheKey } from '../src/lib/cache';
import { createForgeBackend } from '../src/lib/cacheForgeBackend';

describe('cache forge backend adapter', () => {
  test('set calls storageClient.set with wrapped payload and get returns parsed value', async () => {
    const calls: any[] = [];
    // fake storage client
    const storageClient = {
      async set(key: string, val: any) {
        calls.push({ op: 'set', key, val });
      },
      async get(key: string) {
        const call = calls.find((c) => c.op === 'set' && c.key === key);
        return call ? call.val : undefined;
      },
      async delete(key: string) {
        // remove any set entry for the key
        const idx = calls.findIndex((c) => c.op === 'set' && c.key === key);
        if (idx >= 0) calls.splice(idx, 1);
      },
    };

    const backend = createForgeBackend(storageClient as any);
    setBackend(backend);

    const key = makeCacheKey('forge', '1');
    await cache.setCache(key, { x: 1 }, 10);
    const v = await cache.getCache<{ x: number }>(key);
    expect(v).not.toBeNull();
    expect(v?.x).toBe(1);
    await cache.delCache(key);
    const gone = await cache.getCache(key);
    expect(gone).toBeNull();
  });
});
