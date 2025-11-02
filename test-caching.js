// Test script to verify filter caching is working
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000/api/generate-single';

async function testFilter(inputText, filterId, intensity) {
  const startTime = Date.now();
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'filter',
      inputText,
      filterId,
      intensity,
      selectedModel: 'haiku-4.5'
    })
  });
  
  const result = await response.json();
  const timeMs = Date.now() - startTime;
  
  console.log(`[${timeMs}ms] ${filterId}-${intensity}: "${result.text?.substring(0, 50)}..."`);
  return result.text;
}

async function runTest() {
  console.log('\n=== Filter Caching Test ===\n');
  
  const originalText = "The cat sat on the mat.";
  
  console.log('1. First generation (should take time):');
  console.log('Original:', originalText);
  
  // Generate simplify-50
  const text1 = await testFilter(originalText, 'simplify', 50);
  
  // Generate simplify-50|formalize-75 (using result from simplify)
  const text2 = await testFilter(text1, 'formalize', 75);
  
  console.log('\n2. Generate a different branch:');
  // Generate simplify-50|humor-100 (should reuse simplify-50)
  const text3 = await testFilter(text1, 'humor', 100);
  
  console.log('\n3. Regenerate same combination (should be instant if cached):');
  // Try the exact same chain again - should be cached
  const text1b = await testFilter(originalText, 'simplify', 50);
  const text2b = await testFilter(text1b, 'formalize', 75);
  
  console.log('\n=== Results ===');
  console.log('First simplify-50 matches second?', text1 === text1b ? '✓ YES' : '✗ NO');
  console.log('First formalize-75 matches second?', text2 === text2b ? '✓ YES' : '✗ NO');
  
  // Note: This tests API-level, not the UI caching which happens in the React component
  console.log('\nNote: This tests API responses. The actual UI caching happens in the React component.');
  console.log('Check the browser console for "Skipping ... - already cached" messages when reordering layers.');
}

// Wait a bit for server to start, then run test
setTimeout(runTest, 3000);
