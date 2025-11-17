import { default as logger, childWithRequestId } from '../src/lib/logger';

describe('logger', () => {
    test('childWithRequestId returns a logger instance with standard methods', () => {
        const reqId = 'test-req-123';
        const child = childWithRequestId(reqId);

        expect(child).toBeDefined();
        expect(typeof child.info).toBe('function');
        expect(typeof child.error).toBe('function');
        // calling methods should not throw
        expect(() => child.info('logger test info', { requestId: reqId })).not.toThrow();
        expect(() => child.error('logger test error', { requestId: reqId })).not.toThrow();
    });

    test('default logger has expected methods', () => {
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.child).toBe('function');
    });
});