import Resolver from '@forge/resolver';

// Cache wiring and a minimal report.build resolver
import { setBackend as setCacheBackend, checksum, makeCacheKey, setCache, getCache } from '../lib/cache';
import createForgeBackend from '../lib/cacheForgeBackend';
import { REPORT_CACHE_TTL_SECONDS } from '../config/constants';

const resolver = new Resolver();

// Safe attempt to wire Forge storage backend. In test or non-Forge environments
// `asApp` may be unavailable; wrap in try/catch and fall back to the in-memory backend.
try {
  // Require here to avoid importing @forge/api in environments where it's not present
  // at runtime during tests.
  // eslint-disable-next-line global-require
  const { asApp } = require('@forge/api');
  if (asApp && typeof asApp === 'function') {
    const storageClient = asApp().storage;
    if (storageClient) {
      const backend = createForgeBackend(storageClient);
      setCacheBackend(backend);
    }
  }
} catch (e) {
  // Non-fatal: continue with the default in-memory backend for local dev and tests.
}

resolver.define('getText', (req) => {
  console.log(req);
  return 'Hello, world!';
});

// Minimal report.build resolver that demonstrates cache usage.
resolver.define('report.build', async (req) => {
  const payload = req && req.payload ? req.payload : {};

  // Allow clients to pass an explicit cacheKey or derive one from the request checksum
  const key = payload.cacheKey || makeCacheKey('report', checksum(payload));

  // Try cache first
  const cached = await getCache(key);
  if (cached) {
    return { fromCache: true, payload: cached, cacheKey: key };
  }

  // Minimal report generation (placeholder for computeMetrics pipeline)
  const report = {
    id: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    timeWindow: payload.window || null,
    scopeRef: payload.scope || null,
    metricValues: {},
    issueLists: {},
    narrative: '',
    checksum: checksum(payload),
    partialData: false,
  };

  // Cache result with configured TTL
  await setCache(key, report, REPORT_CACHE_TTL_SECONDS);

  return { fromCache: false, payload: report, cacheKey: key };
});

export const handler = resolver.getDefinitions();
