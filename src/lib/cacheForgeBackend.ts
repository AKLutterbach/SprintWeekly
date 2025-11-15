import { StorageBackend } from './cache';

/**
 * Create a StorageBackend that wraps a Forge storage-like client.
 *
 * The factory accepts any object that exposes async methods to get/set/delete keys.
 * Common Forge storage clients expose `get(key)`, `set(key, value)`, and `delete(key)`.
 * This adapter serializes values as JSON and adds an `expiresAt` field when ttl is supplied.
 *
 * Usage in a resolver (pseudo):
 *   import { createForgeBackend } from './lib/cacheForgeBackend';
 *   import cache from './lib/cache';
 *
 *   const backend = createForgeBackend(asApp().storage);
 *   cache.setBackend(backend);
 */

type ForgeStorageLike = {
  get?: (key: string) => Promise<any>;
  set?: (key: string, value: any) => Promise<void>;
  delete?: (key: string) => Promise<void>;
  remove?: (key: string) => Promise<void>;
};

export function createForgeBackend(storageClient: ForgeStorageLike): StorageBackend {
  if (!storageClient) {
    throw new Error('storageClient is required');
  }

  const getRaw = async (key: string): Promise<string | undefined> => {
    // try common method names
    if (storageClient.get) {
      const res = await storageClient.get(key);
      // Some storage clients return the raw value or an object with value property
      if (res === undefined || res === null) return undefined;
      return typeof res === 'string' ? res : JSON.stringify(res);
    }
    return undefined;
  };

  const setRaw = async (key: string, value: string) => {
    if (storageClient.set) {
      // Some Forge storage.set accepts objects; pass the string to be safe
      return storageClient.set(key, value);
    }
    throw new Error('storageClient.set not available');
  };

  const delRaw = async (key: string) => {
    if (storageClient.delete) return storageClient.delete(key);
    if (storageClient.remove) return storageClient.remove(key);
    throw new Error('storageClient.delete/remove not available');
  };

  return {
    async get(key: string) {
      const raw = await getRaw(key);
      return raw === undefined ? undefined : raw;
    },
    async set(key: string, value: string, ttlSec?: number) {
      // store JSON wrapper with expiresAt metadata when ttl is provided
      let payload: string;
      try {
        const parsed = JSON.parse(value);
        // If the incoming value is already a wrapper ({ v: ... }), unwrap once
        const inner = parsed && typeof parsed === 'object' && 'v' in parsed ? parsed.v : parsed;
        const wrapper: any = { v: inner };
        if (ttlSec) wrapper.expiresAt = Date.now() + ttlSec * 1000;
        payload = JSON.stringify(wrapper);
      } catch (e) {
        // value is not JSON; wrap it as a raw string
        const wrapper: any = { v: value };
        if (ttlSec) wrapper.expiresAt = Date.now() + ttlSec * 1000;
        payload = JSON.stringify(wrapper);
      }
      await setRaw(key, payload);
    },
    async del(key: string) {
      await delRaw(key);
    },
  };
}

export default createForgeBackend;
