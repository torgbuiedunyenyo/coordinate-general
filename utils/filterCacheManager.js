// Helper functions for cache key management

// Generate cache key from active filter chain
// CRITICAL: First filter has NO 'original|' prefix
export function buildCacheKey(activeFilters) {
  if (!activeFilters || activeFilters.length === 0) {
    return 'original';
  }
  
  const parts = activeFilters.map(f => {
    const roundedIntensity = Math.round(f.intensity / 25) * 25;
    return `${f.id}-${roundedIntensity}`;
  });
  
  return parts.join('|'); // e.g., 'simplify-75|formalize-50|humor-100'
}

// Generate cache key up to a specific step index
export function getCacheKeyForStep(activeFilters, stepIndex) {
  if (!activeFilters || activeFilters.length === 0 || stepIndex < 0) {
    return 'original';
  }
  
  const filtersUpToStep = activeFilters.slice(0, stepIndex + 1);
  return buildCacheKey(filtersUpToStep);
}

// Find what can be reused from cache when filters change
export function findReusableSteps(newFilterChain, cache) {
  if (!newFilterChain || newFilterChain.length === 0) {
    return {
      reusableUpToIndex: -1,
      cacheKey: 'original',
      text: cache['original']
    };
  }
  
  // Check each step to find longest matching prefix in cache
  let longestMatchIndex = -1;
  let matchKey = 'original';
  let matchText = cache['original'];
  
  for (let i = 0; i < newFilterChain.length; i++) {
    const keyForThisStep = getCacheKeyForStep(newFilterChain, i);
    
    if (cache[keyForThisStep]) {
      // This step is cached
      longestMatchIndex = i;
      matchKey = keyForThisStep;
      matchText = cache[keyForThisStep];
    } else {
      // This step is NOT cached - stop looking
      break;
    }
  }
  
  return {
    reusableUpToIndex: longestMatchIndex,
    cacheKey: matchKey,
    text: matchText,
    needsGenerationFromIndex: longestMatchIndex + 1
  };
}

// Calculate generation plan given current filters and cache
export function calculateGenerationPlan(activeFilters, cache) {
  const plan = [];
  
  if (!activeFilters || activeFilters.length === 0) {
    return plan; // Empty plan - nothing to generate
  }
  
  const reusable = findReusableSteps(activeFilters, cache);
  let currentText = reusable.text;
  let previousKey = reusable.cacheKey;
  
  // Start generating from where cache ends
  for (let i = reusable.needsGenerationFromIndex; i < activeFilters.length; i++) {
    const filter = activeFilters[i];
    const roundedIntensity = Math.round(filter.intensity / 25) * 25;
    
    // Build cache key for this step
    const filterKey = `${filter.id}-${roundedIntensity}`;
    const cacheKey = previousKey === 'original' 
      ? filterKey 
      : `${previousKey}|${filterKey}`;
    
    plan.push({
      stepIndex: i,
      filter,
      inputText: currentText,
      filterId: filter.id,
      intensity: roundedIntensity,
      cacheKey,
      previousKey
    });
    
    // For next iteration
    previousKey = cacheKey;
    // currentText will be updated with generated result
  }
  
  return plan;
}

// Validate a cache key format
export function isValidCacheKey(key) {
  if (key === 'original') return true;
  
  // Format: 'filterId-intensity|filterId-intensity|...'
  const parts = key.split('|');
  
  for (const part of parts) {
    const [filterId, intensity] = part.split('-');
    
    if (!filterId || !intensity) return false;
    
    const intensityNum = parseInt(intensity, 10);
    if (![25, 50, 75, 100].includes(intensityNum)) return false;
  }
  
  return true;
}

// Get all cache keys that should be invalidated when a filter at index changes
export function getInvalidatedCacheKeys(activeFilters, changedIndex, cache) {
  const keysToInvalidate = [];
  
  // Build all possible cache keys that include or come after the changed filter
  for (let i = changedIndex; i < activeFilters.length; i++) {
    const key = getCacheKeyForStep(activeFilters, i);
    if (cache[key]) {
      keysToInvalidate.push(key);
    }
  }
  
  return keysToInvalidate;
}

// Clear invalidated cache entries
export function clearInvalidatedCache(cache, keysToInvalidate) {
  const newCache = { ...cache };
  
  for (const key of keysToInvalidate) {
    if (key !== 'original') { // Never delete the original
      delete newCache[key];
    }
  }
  
  return newCache;
}

// Get a human-readable summary of the filter chain
export function getFilterChainSummary(activeFilters) {
  if (!activeFilters || activeFilters.length === 0) {
    return 'No filters applied';
  }
  
  return activeFilters
    .map(f => `${f.name} (${f.intensity}%)`)
    .join(' → ');
}

// Calculate the total number of API calls needed
export function estimateApiCalls(activeFilters, cache) {
  const plan = calculateGenerationPlan(activeFilters, cache);
  return plan.length;
}
