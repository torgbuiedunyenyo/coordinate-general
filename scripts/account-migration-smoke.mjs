// Real provider integration test. Start the built app with its intended credentials first.
import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3312';
for (const selectedModel of ['haiku-4.5', 'sonnet-4.5']) {
  const response = await fetch(`${base}/api/generate-single`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'bridge', textLeft: 'A quiet morning by the sea.', textRight: 'A lively evening in the city.', selectedModel }), signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 200, `${selectedModel}: HTTP ${response.status}`);
  const result = await response.json();
  assert.equal(result.success, true);
  assert.ok(result.text.length > 20);
  assert.ok(result.usage.outputTokens > 0);
  console.log(JSON.stringify({ selectedModel, http: response.status, characters: result.text.length, usage: result.usage }));
}
