// Helper functions for cache key management

// Generate cache key from active filter chain
// CRITICAL: Process filters from bottom to top (reverse visual order)
// Visual stack: [newest/top, ..., oldest/bottom]
// Processing order: oldest/bottom -> newest/top
export function buildCacheKey(activeFilters) {
  if (!activeFilters || activeFilters.length === 0) {
    return 'original';
  }
  
  // Reverse the filters array to process bottom-to-top (Photoshop-style)
  const reversedFilters = [...activeFilters].reverse();
  const parts = reversedFilters.map(f => {
    const roundedIntensity = Math.round(f.intensity / 25) * 25;
    return `${f.id}-${roundedIntensity}`;
  });
  
  return parts.join('|'); // e.g., 'simplify-75|formalize-50|humor-100'
}

// Generate cache key up to a specific step index
// stepIndex is in visual order (0 = top layer)
export function getCacheKeyForStep(activeFilters, stepIndex) {
  if (!activeFilters || activeFilters.length === 0 || stepIndex < 0) {
    return 'original';
  }
  
  // Include all filters from bottom up to and including the one at stepIndex
  // Since we want bottom-to-top processing, we take from stepIndex to end
  const filtersUpToStep = activeFilters.slice(stepIndex);
  return buildCacheKey(filtersUpToStep);
}

// Find what can be reused from cache when filters change
export function findReusableSteps(newFilterChain, cache) {
  if (!newFilterChain || newFilterChain.length === 0) {
    return {
      reusableUpToIndex: newFilterChain.length,
      cacheKey: 'original',
      text: cache['original'],
      needsGenerationFromIndex: newFilterChain.length
    };
  }
  
  // Check from bottom to top to find longest matching chain in cache
  // Start from the bottom layer (last index) and work up
  let longestMatchIndex = newFilterChain.length;
  let matchKey = 'original';
  let matchText = cache['original'];
  
  for (let i = newFilterChain.length - 1; i >= 0; i--) {
    const keyForThisStep = getCacheKeyForStep(newFilterChain, i);
    
    if (cache[keyForThisStep]) {
      // This step is cached
      longestMatchIndex = i;
      matchKey = keyForThisStep;
      matchText = cache[keyForThisStep];
      break; // Found the topmost cached layer
    }
  }
  
  return {
    reusableUpToIndex: longestMatchIndex,
    cacheKey: matchKey,
    text: matchText,
    needsGenerationFromIndex: longestMatchIndex - 1
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
  
  // Generate from bottom to top (reverse order)
  // Start from where cache ends and work up to the top layer
  for (let i = reusable.needsGenerationFromIndex; i >= 0; i--) {
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
  
  // Invalidate all cache keys that include the changed filter
  // Since we process bottom-to-top, changing a filter invalidates
  // itself and all filters above it (indices 0 to changedIndex)
  for (let i = 0; i <= changedIndex; i++) {
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
  
  // Show in processing order (bottom to top)
  return [...activeFilters].reverse()
    .map(f => `${f.name} (${f.intensity}%)`)
    .join(' → ');
}

// Calculate the total number of API calls needed
export function estimateApiCalls(activeFilters, cache) {
  const plan = calculateGenerationPlan(activeFilters, cache);
  return plan.length;
}
