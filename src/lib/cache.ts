import crypto from 'crypto';

/**
 * Simple cache abstraction.
 * - Defaults to an in-memory backend for local tests and dev.
 * - Provides async get/set/del and TTL support (seconds).
 * - Exposes helpers: makeCacheKey and checksum.
 */

export type CacheValue = unknown;

export interface StorageBackend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlSec?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class InMemoryBackend implements StorageBackend {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSec?: number) {
    const expiresAt = ttlSec ? Date.now() + ttlSec * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string) {
    this.store.delete(key);
  }
}

// Default backend instance
let backend: StorageBackend = new InMemoryBackend();

export function setBackend(b: StorageBackend) {
  backend = b;
}

export function makeCacheKey(...parts: Array<string | number>) {
  return parts.map(String).join(':');
}

export function checksum(obj: unknown) {
  const str = JSON.stringify(obj);
  return crypto.createHash('sha256').update(str).digest('hex');
}

export async function setCache(key: string, value: CacheValue, ttlSec?: number) {
  const payload = JSON.stringify({ v: value });
  await backend.set(key, payload, ttlSec);
}

export async function getCache<T = CacheValue>(key: string): Promise<T | null> {
  const raw = await backend.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.v as T;
  } catch (e) {
    // If stored payload is corrupt, delete and return null
    await backend.del(key);
    return null;
  }
}

export async function delCache(key: string) {
  await backend.del(key);
}

export default {
  setBackend,
  makeCacheKey,
  checksum,
  setCache,
  getCache,
  delCache,
};
