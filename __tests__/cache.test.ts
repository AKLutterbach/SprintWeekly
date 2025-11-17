import cache, { makeCacheKey } from '../src/lib/cache';

describe('cache (in-memory)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('set and get a value', async () => {
    const key = makeCacheKey('test', '1');
    await cache.setCache(key, { hello: 'world' });
    const v = await cache.getCache<{ hello: string }>(key);
    expect(v).not.toBeNull();
    expect(v?.hello).toBe('world');
    await cache.delCache(key);
    const gone = await cache.getCache(key);
    expect(gone).toBeNull();
  });

  test('ttl expires entries', async () => {
    const key = makeCacheKey('ttl', '1');
    await cache.setCache(key, { a: 1 }, 1); // 1 second
    let v = await cache.getCache(key);
    expect(v).not.toBeNull();
    // advance 1500ms
    jest.advanceTimersByTime(1500);
    // call through to allow timers to flush (no timers in backend but use time checks)
    v = await cache.getCache(key);
    expect(v).toBeNull();
  });
});
