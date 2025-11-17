import React, { useState } from 'react';
import ForgeReconciler, { Text, Button, Stack, Heading } from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const testReportBuild = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Test with a simple request
      const payload = {
        requestId: 'test-' + Date.now(),
        scope: { type: 'project', ref: 'DEMO' },
        window: { type: 'calendar', start: '2025-01-01', end: '2025-01-31' },
        metrics: ['throughput']
      };
      
      console.log('Calling report.build with:', payload);
      const response = await invoke('report.build', payload);
      console.log('Response from report.build:', response);
      console.log('Response type:', typeof response);
      console.log('Response keys:', response ? Object.keys(response) : 'null');
      
      if (response === null || response === undefined) {
        setError('Resolver returned null/undefined');
      } else {
        // Convert to plain object and stringify immediately
        const plainResponse = JSON.parse(JSON.stringify(response));
        const stringified = JSON.stringify(plainResponse, null, 2);
        console.log('Stringified result:', stringified);
        console.log('String length:', stringified.length);
        setResult(stringified);
      }
    } catch (e) {
      console.error('Error calling report.build:', e);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack space="medium">
      <Text>Sprint Weekly - Backend Test</Text>
      
      <Button 
        text={loading ? "Testing..." : "Test report.build Resolver"} 
        onClick={testReportBuild}
        isDisabled={loading}
      />
      
      {error && (
        <Stack space="small">
          <Text>Error:</Text>
          <Text>{error}</Text>
        </Stack>
      )}
      
      <Stack space="small">
        <Heading size="small">Result:</Heading>
        <Text>{result || 'Click the button to test'}</Text>
      </Stack>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
