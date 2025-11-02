import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Filters.module.css';
import { filterSessionManager } from '../utils/filterSessionManager';
import { AVAILABLE_FILTERS, validateFilterInputs, calculateCostEstimate } from '../utils/filterDefinitions';
import { 
  buildCacheKey, 
  getCacheKeyForStep, 
  calculateGenerationPlan,
  getFilterChainSummary 
} from '../utils/filterCacheManager';

export default function Filters() {
  const [originalText, setOriginalText] = useState('');
  const [selectedModel, setSelectedModel] = useState('haiku-4.5');
  const [filterStackInitialized, setFilterStackInitialized] = useState(false);
  const [filters, setFilters] = useState(
    AVAILABLE_FILTERS.map(f => ({
      ...f,
      enabled: false,
      intensity: f.defaultIntensity,
      order: null
    }))
  );
  const [cache, setCache] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGeneratingStep, setCurrentGeneratingStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const [generatingKeys, setGeneratingKeys] = useState([]);
  const [finalResult, setFinalResult] = useState(null);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [unsavedChangeCount, setUnsavedChangeCount] = useState(0);
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0 });
  const [errors, setErrors] = useState([]);
  const [error, setError] = useState(null);
  const [failedSteps, setFailedSteps] = useState({});
  const [storageWarning, setStorageWarning] = useState(null);
  const [expandedFilters, setExpandedFilters] = useState({});

  // Model configurations
  const models = [
    {
      id: 'haiku-4.5',
      name: 'Claude Haiku 4.5',
      description: 'Fast & cost-effective ($0.25/$1.25 per M tokens)',
      provider: 'anthropic'
    },
    {
      id: 'sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      description: 'Advanced reasoning ($3/$15 per M tokens)',
      provider: 'anthropic'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      description: 'Google\'s fast multimodal model',
      provider: 'google'
    }
  ];

  // Load existing session on mount
  useEffect(() => {
    const session = filterSessionManager.loadSession();
    if (session) {
      setOriginalText(session.originalText || '');
      setSelectedModel(session.selectedModel || 'haiku-4.5');
      setFilterStackInitialized(session.filterStackInitialized || false);
      setFilters(session.filters || filters);
      setCache(session.cache || {});
      setFinalResult(session.finalResult || null);
      setTotalTokens(session.totalTokens || { input: 0, output: 0 });
    }

    const warning = filterSessionManager.getStorageWarning();
    if (warning) {
      setStorageWarning(warning);
    }
  }, []);

  // Get active filters in order
  const getActiveFilters = useCallback(() => {
    return filters
      .filter(f => f.enabled)
      .sort((a, b) => a.order - b.order);
  }, [filters]);

  // Handle Load Filters button
  const handleLoadFilters = () => {
    const validationErrors = validateFilterInputs(originalText);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    
    // Initialize session
    const initialFilters = filters.map(f => ({
      ...f,
      enabled: false,
      order: null
    }));
    
    filterSessionManager.initSession(originalText.trim(), selectedModel, initialFilters);
    
    setCache({ 'original': originalText.trim() });
    setFilterStackInitialized(true);
    setFilters(initialFilters);
    setHasUnsavedChanges(false);
    setUnsavedChangeCount(0);
  };

  // Handle filter enable/disable
  const handleFilterToggle = (filterId) => {
    const newFilters = [...filters];
    const filterIndex = newFilters.findIndex(f => f.id === filterId);
    const filter = newFilters[filterIndex];
    
    if (filter.enabled) {
      // Disabling
      filter.enabled = false;
      filter.order = null;
      
      // Reorder remaining filters
      newFilters.forEach(f => {
        if (f.enabled && f.order > filter.order) {
          f.order -= 1;
        }
      });
    } else {
      // Enabling
      filter.enabled = true;
      const enabledCount = newFilters.filter(f => f.enabled).length;
      filter.order = enabledCount - 1; // 0-indexed
    }
    
    setFilters(newFilters);
    setHasUnsavedChanges(true);
    setUnsavedChangeCount(prev => prev + 1);
    filterSessionManager.updateAllFilters(newFilters);
  };

  // Handle intensity change
  const handleIntensityChange = (filterId, newIntensity) => {
    const newFilters = [...filters];
    const filterIndex = newFilters.findIndex(f => f.id === filterId);
    newFilters[filterIndex].intensity = parseInt(newIntensity);
    
    setFilters(newFilters);
    setHasUnsavedChanges(true);
    setUnsavedChangeCount(prev => prev + 1);
    filterSessionManager.updateAllFilters(newFilters);
  };

  // Handle reordering
  const handleReorder = (filterId, direction) => {
    const newFilters = [...filters];
    const enabledFilters = newFilters.filter(f => f.enabled);
    
    const currentFilter = enabledFilters.find(f => f.id === filterId);
    if (!currentFilter) return;
    
    const currentIndex = currentFilter.order;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex < 0 || newIndex >= enabledFilters.length) return;
    
    // Find filter to swap with
    const swapFilter = enabledFilters.find(f => f.order === newIndex);
    if (!swapFilter) return;
    
    // Swap orders
    const temp = currentFilter.order;
    currentFilter.order = swapFilter.order;
    swapFilter.order = temp;
    
    setFilters(newFilters);
    setHasUnsavedChanges(true);
    setUnsavedChangeCount(prev => prev + 1);
    filterSessionManager.updateAllFilters(newFilters);
  };

  // Generate single filter step
  const generateFilterStep = async (inputText, filterId, intensity, model) => {
    const response = await fetch('/api/generate-single', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'filter',
        inputText,
        filterId,
        intensity,
        selectedModel: model
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || 'Generation failed');
    }
    
    return await response.json();
  };

  // Apply filter stack
  const applyFilterStack = async () => {
    const activeFilters = getActiveFilters();
    
    if (activeFilters.length === 0) {
      setFinalResult(cache['original'] || originalText);
      setHasUnsavedChanges(false);
      setUnsavedChangeCount(0);
      filterSessionManager.updateFinalResult(cache['original'] || originalText);
      return;
    }
    
    // Calculate generation plan
    const generationPlan = calculateGenerationPlan(activeFilters, cache);
    
    if (generationPlan.length === 0) {
      // Everything is cached
      const finalKey = buildCacheKey(activeFilters);
      setFinalResult(cache[finalKey]);
      setHasUnsavedChanges(false);
      setUnsavedChangeCount(0);
      filterSessionManager.updateFinalResult(cache[finalKey]);
      return;
    }
    
    // Execute generation plan
    setIsGenerating(true);
    setCurrentGeneratingStep(0);
    setTotalSteps(generationPlan.length);
    setGeneratingKeys(generationPlan.map(p => p.cacheKey));
    setFailedSteps({});
    setError(null);
    
    let lastSuccessfulText = null;
    
    for (let i = 0; i < generationPlan.length; i++) {
      const step = generationPlan[i];
      
      setCurrentGeneratingStep(i + 1);
      
      try {
        console.log(`Generating step ${i + 1}/${generationPlan.length}: ${step.cacheKey}`);
        
        const result = await generateFilterStep(
          step.inputText,
          step.filterId,
          step.intensity,
          selectedModel
        );
        
        // Update cache
        const newCache = { ...cache, [step.cacheKey]: result.text };
        setCache(newCache);
        filterSessionManager.updateCache(step.cacheKey, result.text);
        
        // Update token usage
        if (result.usage) {
          setTotalTokens(prev => ({
            input: prev.input + (result.usage.inputTokens || 0),
            output: prev.output + (result.usage.outputTokens || 0)
          }));
          filterSessionManager.updateTokens(
            result.usage.inputTokens || 0,
            result.usage.outputTokens || 0
          );
        }
        
        // For next step, use this result
        if (i < generationPlan.length - 1) {
          generationPlan[i + 1].inputText = result.text;
        }
        
        lastSuccessfulText = result.text;
        
      } catch (error) {
        console.error(`Error generating ${step.cacheKey}:`, error);
        
        setFailedSteps(prev => ({
          ...prev,
          [step.cacheKey]: error.message
        }));
        
        setError(`Generation failed at step ${i + 1}: ${error.message}`);
        setIsGenerating(false);
        return;
      }
    }
    
    // All steps succeeded
    setFinalResult(lastSuccessfulText);
    filterSessionManager.updateFinalResult(lastSuccessfulText);
    setIsGenerating(false);
    setHasUnsavedChanges(false);
    setUnsavedChangeCount(0);
    setError(null);
    
    // Save session
    filterSessionManager.saveSession({
      originalText: originalText.trim(),
      selectedModel,
      filterStackInitialized,
      filters,
      cache,
      finalResult: lastSuccessfulText,
      totalTokens,
      lastModified: new Date().toISOString()
    });
  };

  // Handle Reset All
  const handleResetAll = () => {
    const newFilters = filters.map(f => ({
      ...f,
      enabled: false,
      order: null,
      intensity: f.defaultIntensity
    }));
    
    const newCache = { 'original': cache['original'] };
    
    setFilters(newFilters);
    setCache(newCache);
    setFinalResult(null);
    setHasUnsavedChanges(false);
    setUnsavedChangeCount(0);
    setError(null);
    setFailedSteps({});
    
    filterSessionManager.saveSession({
      originalText: originalText.trim(),
      selectedModel,
      filterStackInitialized,
      filters: newFilters,
      cache: newCache,
      finalResult: null,
      totalTokens: { input: 0, output: 0 },
      lastModified: new Date().toISOString()
    });
  };

  // Handle Start Over
  const handleStartOver = () => {
    filterSessionManager.clearSession();
    
    setOriginalText('');
    setSelectedModel('haiku-4.5');
    setFilterStackInitialized(false);
    setFilters(
      AVAILABLE_FILTERS.map(f => ({
        ...f,
        enabled: false,
        intensity: f.defaultIntensity,
        order: null
      }))
    );
    setCache({});
    setFinalResult(null);
    setHasUnsavedChanges(false);
    setUnsavedChangeCount(0);
    setTotalTokens({ input: 0, output: 0 });
    setError(null);
    setFailedSteps({});
    setExpandedFilters({});
  };

  // Toggle filter expansion
  const toggleFilterExpansion = (filterId) => {
    setExpandedFilters(prev => ({
      ...prev,
      [filterId]: !prev[filterId]
    }));
  };

  // Get cache status for a filter
  const getFilterStatus = (filter) => {
    const activeFilters = getActiveFilters();
    const filterIndex = activeFilters.findIndex(f => f.id === filter.id);
    
    if (filterIndex === -1) return null;
    
    const cacheKey = getCacheKeyForStep(activeFilters, filterIndex);
    
    if (failedSteps[cacheKey]) return 'error';
    if (generatingKeys.includes(cacheKey) && isGenerating) return 'generating';
    if (cache[cacheKey]) return 'cached';
    
    return 'pending';
  };

  const charCount = originalText.length;
  const charCountColor = charCount < 50 ? '#dc3545' : charCount > 1000 ? '#dc3545' : '#28a745';
  
  const costEstimate = calculateCostEstimate(totalTokens, selectedModel);

  return (
    <div className={styles.container}>
      <Head>
        <title>Filter Stack - Text Transformer</title>
        <meta name="description" content="Apply sequential transformations like photo filters" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        {/* Navigation */}
        <nav className={styles.featureNav}>
          <Link href="/setup" className={styles.navLink}>
            Coordinate Plane
          </Link>
          <span className={styles.separator}>|</span>
          <Link href="/bridge-setup" className={styles.navLink}>
            Bridge
          </Link>
          <span className={styles.separator}>|</span>
          <Link href="/filters" className={`${styles.navLink} ${styles.active}`}>
            Filters
          </Link>
        </nav>

        <h1 className={styles.title}>Filter Stack</h1>
        <p className={styles.description}>
          Apply sequential transformations like photo filters for text.
        </p>

        {/* Input Section */}
        {!filterStackInitialized && (
          <div className={styles.inputSection}>
            <div className={styles.formGroup}>
              <label htmlFor="originalText" className={styles.label}>
                Your Text
                <span className={styles.charCount} style={{ color: charCountColor }}>
                  {charCount}/1000 characters
                </span>
              </label>
              <textarea
                id="originalText"
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                className={styles.textarea}
                placeholder="Enter your text here (50-1000 characters)..."
                rows={8}
                maxLength={1000}
              />
            </div>

            {/* Error Messages */}
            {errors.length > 0 && (
              <div className={styles.errorContainer}>
                {errors.map((error, index) => (
                  <p key={index} className={styles.error}>
                    {error}
                  </p>
                ))}
              </div>
            )}

            {/* Storage Warning */}
            {storageWarning && (
              <div className={styles.warningContainer}>
                <p className={styles.warning}>
                  ⚠️ {storageWarning}
                </p>
              </div>
            )}

            {/* Model Selection and Load Filters Button */}
            <div className={styles.submitSection}>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className={styles.modelSelect}
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleLoadFilters}
                className={styles.loadButton}
              >
                Load Filters
              </button>
            </div>
          </div>
        )}

        {/* Filter Stack Section */}
        {filterStackInitialized && (
          <>
            {/* Pending Changes Badge */}
            {hasUnsavedChanges && (
              <div className={styles.pendingBadge}>
                ⚠️ {unsavedChangeCount} unsaved change{unsavedChangeCount > 1 ? 's' : ''}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className={styles.errorContainer}>
                <p className={styles.error}>{error}</p>
              </div>
            )}

            {/* Filter List */}
            <div className={styles.filterList}>
              {filters.map((filter) => {
                const status = getFilterStatus(filter);
                const activeFilters = getActiveFilters();
                const filterIndex = activeFilters.findIndex(f => f.id === filter.id);
                const cacheKey = filterIndex >= 0 ? getCacheKeyForStep(activeFilters, filterIndex) : null;
                const cachedText = cacheKey ? cache[cacheKey] : null;
                const errorMessage = cacheKey ? failedSteps[cacheKey] : null;
                
                return (
                  <div
                    key={filter.id}
                    className={`${styles.filterCard} ${
                      filter.enabled ? styles.enabled : styles.disabled
                    } ${status === 'error' ? styles.error : ''} ${
                      status === 'generating' ? styles.generating : ''
                    }`}
                  >
                    <div className={styles.filterHeader}>
                      <input
                        type="checkbox"
                        checked={filter.enabled}
                        onChange={() => handleFilterToggle(filter.id)}
                        className={styles.checkbox}
                      />
                      <span className={styles.filterIcon}>{filter.icon}</span>
                      <span className={styles.filterName}>{filter.name}</span>
                      {filter.enabled && (
                        <div className={styles.reorderButtons}>
                          <button
                            onClick={() => handleReorder(filter.id, 'up')}
                            disabled={filter.order === 0}
                            className={styles.reorderButton}
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleReorder(filter.id, 'down')}
                            disabled={filter.order === activeFilters.length - 1}
                            className={styles.reorderButton}
                            title="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                      {status && (
                        <div className={`${styles.statusIndicator} ${styles[status]}`}>
                          {status === 'cached' && '✓'}
                          {status === 'generating' && '⟳'}
                          {status === 'error' && '✗'}
                          {status === 'pending' && '○'}
                        </div>
                      )}
                    </div>
                    
                    <div className={styles.filterDescription}>
                      {filter.description}
                    </div>
                    
                    {filter.enabled && (
                      <div className={styles.filterControls}>
                        <label className={styles.intensityLabel}>
                          Intensity:
                        </label>
                        <input
                          type="range"
                          min="25"
                          max="100"
                          step="25"
                          value={filter.intensity}
                          onChange={(e) => handleIntensityChange(filter.id, e.target.value)}
                          className={styles.intensitySlider}
                          disabled={!filter.enabled}
                        />
                        <span className={styles.intensityValue}>
                          {filter.intensity}%
                        </span>
                      </div>
                    )}
                    
                    {errorMessage && (
                      <div className={styles.errorMessage}>
                        Error: {errorMessage}
                      </div>
                    )}
                    
                    {cachedText && filter.enabled && (
                      <button
                        onClick={() => toggleFilterExpansion(filter.id)}
                        className={styles.expandButton}
                      >
                        {expandedFilters[filter.id] ? '▼ Hide' : '▶ View'} Result
                      </button>
                    )}
                    
                    {expandedFilters[filter.id] && cachedText && (
                      <div className={styles.expandedResult}>
                        {cachedText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
              <button
                onClick={applyFilterStack}
                disabled={isGenerating || !hasUnsavedChanges}
                className={styles.applyButton}
              >
                {isGenerating 
                  ? `Generating... (${currentGeneratingStep}/${totalSteps})`
                  : 'Apply Filters'
                }
              </button>
              <button
                onClick={handleResetAll}
                disabled={isGenerating}
                className={styles.resetButton}
              >
                Reset All
              </button>
            </div>

            {/* Results Section */}
            {finalResult && (
              <div className={styles.resultsSection}>
                <h2 className={styles.resultsTitle}>Final Result</h2>
                
                <div className={styles.tokenDisplay}>
                  <span><strong>Input:</strong> {totalTokens.input} tokens</span>
                  <span className={styles.separator}>|</span>
                  <span><strong>Output:</strong> {totalTokens.output} tokens</span>
                  <span className={styles.separator}>|</span>
                  <span><strong>Total:</strong> {totalTokens.input + totalTokens.output} tokens</span>
                  <span className={styles.separator}>|</span>
                  <span><strong>≈</strong> {costEstimate.formatted}</span>
                </div>
                
                <div className={styles.resultText}>
                  {finalResult}
                </div>
                
                <div className={styles.resultActions}>
                  <button
                    onClick={() => setPipelineExpanded(!pipelineExpanded)}
                    className={styles.pipelineButton}
                  >
                    {pipelineExpanded ? 'Hide Pipeline' : 'View Pipeline'}
                  </button>
                  <button
                    onClick={handleStartOver}
                    className={styles.startOverButton}
                  >
                    Start Over
                  </button>
                </div>
                
                {/* Pipeline Display */}
                {pipelineExpanded && (
                  <div className={styles.pipeline}>
                    <h3>Generation Pipeline</h3>
                    
                    <div className={styles.pipelineStep}>
                      <div className={styles.stepHeader}>Original</div>
                      <div className={styles.stepText}>{cache['original']}</div>
                    </div>
                    
                    {getActiveFilters().map((filter, i) => {
                      const cacheKey = getCacheKeyForStep(getActiveFilters(), i);
                      const text = cache[cacheKey];
                      const roundedIntensity = Math.round(filter.intensity / 25) * 25;
                      
                      return (
                        <React.Fragment key={i}>
                          <div className={styles.pipelineArrow}>↓</div>
                          <div className={styles.pipelineStep}>
                            <div className={styles.stepHeader}>
                              {filter.icon} {filter.name} ({roundedIntensity}%)
                            </div>
                            <div className={styles.stepText}>
                              {text || 'Not yet generated'}
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Info Box */}
        {!filterStackInitialized && (
          <div className={styles.infoBox}>
            <h3>How Filter Stack Works:</h3>
            <ol>
              <li>Enter your text (50-1000 characters)</li>
              <li>Load the filter interface</li>
              <li>Enable filters and adjust their intensity</li>
              <li>Reorder filters to change the sequence</li>
              <li>Click "Apply Filters" to generate</li>
              <li>Results are cached for efficient experimentation</li>
            </ol>
            <p className={styles.infoNote}>
              <strong>Note:</strong> Filters are applied sequentially - each filter transforms the output of the previous one, creating a pipeline of transformations.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
