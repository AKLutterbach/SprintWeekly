import Resolver from '@forge/resolver';
import * as cache from '../lib/cache';
import createForgeBackend from '../lib/cacheForgeBackend';
import { buildReport } from './report';

const resolver = new Resolver();

// Attempt to wire Forge storage backend when available
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
  const { asApp } = require('@forge/api');
  if (asApp && typeof asApp === 'function') {
    const storageClient = asApp().storage;
    if (storageClient) {
      const backend = createForgeBackend(storageClient);
      cache.setBackend(backend);
    }
  }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) {
  // ignore - use default in-memory backend
}

resolver.define('getText', () => {
  return 'Hello, world!';
});

// Wire report.build to our typed implementation
resolver.define('report.build', async (req) => {
  // Debug logging
  console.log('report.build called with req:', JSON.stringify(req));
  
  // Our typed buildReport expects the payload object
  // When called from invoke(), the payload is the first arg directly
  const payload = (req && req.payload) ? req.payload : req;
  console.log('Extracted payload:', JSON.stringify(payload));
  
  const result = await buildReport(payload);
  console.log('buildReport returned:', JSON.stringify(result));
  
  return result;
});

export const handler = resolver.getDefinitions();

export default handler;
