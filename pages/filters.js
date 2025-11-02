import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Filters.module.css';
import { filterSessionManager } from '../utils/filterSessionManager';
import { AVAILABLE_FILTERS, validateFilterInputs, calculateCostEstimate } from '../utils/filterDefinitions';
import { 
  buildCacheKey, 
  getCacheKeyForStep, 
  calculateGenerationPlan
} from '../utils/filterCacheManager';

export default function Filters() {
  const [originalText, setOriginalText] = useState('');
  const [selectedModel, setSelectedModel] = useState('haiku-4.5');
  const [filterStackInitialized, setFilterStackInitialized] = useState(false);
  const [layers, setLayers] = useState([]);
  const [availableFilters, setAvailableFilters] = useState(AVAILABLE_FILTERS);
  const [cache, setCache] = useState({});
  const [currentDisplayText, setCurrentDisplayText] = useState('');
  const [generatingLayers, setGeneratingLayers] = useState(new Set());
  const [totalTokens, setTotalTokens] = useState({ input: 0, output: 0 });
  const [errors, setErrors] = useState([]);
  const [storageWarning, setStorageWarning] = useState(null);
  const [draggedLayer, setDraggedLayer] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [draggedFilter, setDraggedFilter] = useState(null);
  const [isDraggingOverLayers, setIsDraggingOverLayers] = useState(false);
  const generationQueueRef = useRef([]);
  const isGeneratingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Model configurations
  const models = [
    {
      id: 'haiku-4.5',
      name: 'Claude Haiku 4.5',
      provider: 'anthropic'
    },
    {
      id: 'sonnet-4.5',
      name: 'Claude Sonnet 4.5',
      provider: 'anthropic'
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'google'
    }
  ];

  // Load session on mount
  useEffect(() => {
    const session = filterSessionManager.loadSession();
    if (session && session.filterStackInitialized) {
      setOriginalText(session.originalText || '');
      setSelectedModel(session.selectedModel || 'haiku-4.5');
      setFilterStackInitialized(true);
      setCache(session.cache || { original: session.originalText });
      setTotalTokens(session.totalTokens || { input: 0, output: 0 });
      
      // Reconstruct layers from session
      if (session.layers) {
        setLayers(session.layers);
        // Remove used filters from available
        const usedIds = session.layers.map(l => l.id);
        setAvailableFilters(AVAILABLE_FILTERS.filter(f => !usedIds.includes(f.id)));
      }
    }

    const warning = filterSessionManager.getStorageWarning();
    if (warning) {
      setStorageWarning(warning);
    }
  }, []);

  // Update display text whenever cache or layers change
  useEffect(() => {
    if (!filterStackInitialized) return;
    
    // Find the most complete text available
    const activeLayers = layers.filter(l => l.enabled);
    
    if (activeLayers.length === 0) {
      setCurrentDisplayText(cache['original'] || originalText);
      return;
    }
    
    // Try to find the longest cached chain
    for (let i = activeLayers.length - 1; i >= 0; i--) {
      const cacheKey = getCacheKeyForStep(activeLayers, i);
      if (cache[cacheKey]) {
        setCurrentDisplayText(cache[cacheKey]);
        return;
      }
    }
    
    // Fallback to original
    setCurrentDisplayText(cache['original'] || originalText);
  }, [cache, layers, originalText, filterStackInitialized]);

  // Handle text input and initialization
  const handleInitialize = () => {
    const validationErrors = validateFilterInputs(originalText);
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    
    const initialCache = { 'original': originalText.trim() };
    setCache(initialCache);
    setFilterStackInitialized(true);
    setCurrentDisplayText(originalText.trim());
    setLayers([]);
    setAvailableFilters(AVAILABLE_FILTERS);
    
    // Save session
    filterSessionManager.saveSession({
      originalText: originalText.trim(),
      selectedModel,
      filterStackInitialized: true,
      layers: [],
      cache: initialCache,
      totalTokens: { input: 0, output: 0 },
      lastModified: new Date().toISOString()
    });
  };

  // Add filter as layer (at top, like Photoshop)
  const addLayer = (filter, atIndex = 0) => {
    const newLayer = {
      ...filter,
      enabled: true,
      intensity: filter.defaultIntensity,
      id: filter.id,
      key: `${filter.id}-${Date.now()}` // Unique key for React
    };
    
    // Add at the beginning (top) by default
    const newLayers = [...layers];
    newLayers.splice(atIndex, 0, newLayer);
    setLayers(newLayers);
    setAvailableFilters(prev => prev.filter(f => f.id !== filter.id));
    
    // Save session and trigger generation
    saveSessionAndRegenerate(newLayers);
  };

  // Remove layer
  const removeLayer = (layerId) => {
    const layer = layers.find(l => l.id === layerId);
    const newLayers = layers.filter(l => l.id !== layerId);
    setLayers(newLayers);
    
    if (layer) {
      // Add back to available filters
      const originalFilter = AVAILABLE_FILTERS.find(f => f.id === layer.id);
      if (originalFilter) {
        setAvailableFilters(prev => [...prev, originalFilter].sort((a, b) => {
          // Keep original order
          const aIndex = AVAILABLE_FILTERS.findIndex(f => f.id === a.id);
          const bIndex = AVAILABLE_FILTERS.findIndex(f => f.id === b.id);
          return aIndex - bIndex;
        }));
      }
    }
    
    saveSessionAndRegenerate(newLayers);
  };

  // Toggle layer enabled/disabled
  const toggleLayer = (layerId) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, enabled: !l.enabled } : l
    );
    setLayers(newLayers);
    saveSessionAndRegenerate(newLayers);
  };

  // Change layer intensity
  const changeLayerIntensity = (layerId, intensity) => {
    const newLayers = layers.map(l => 
      l.id === layerId ? { ...l, intensity: parseInt(intensity) } : l
    );
    setLayers(newLayers);
    saveSessionAndRegenerate(newLayers);
  };

  // Drag and drop handlers for layers
  const handleLayerDragStart = (e, index) => {
    setDraggedLayer(index);
    setDraggedFilter(null); // Clear any filter drag
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', 'layer'); // Mark as layer drag
  };

  const handleLayerDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to parent
    
    // Only show drop zone if we're dragging a layer
    if (draggedLayer !== null) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    }
  };

  const handleLayerDragLeave = (e) => {
    // Only clear if we're leaving the layer element itself
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleLayerDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to parent
    
    if (draggedLayer !== null && draggedLayer !== dropIndex) {
      // Moving an existing layer
      const newLayers = [...layers];
      const [movedLayer] = newLayers.splice(draggedLayer, 1);
      
      // Adjust drop index if we removed an item before it
      const adjustedDropIndex = draggedLayer < dropIndex ? dropIndex - 1 : dropIndex;
      newLayers.splice(adjustedDropIndex, 0, movedLayer);
      
      setLayers(newLayers);
      saveSessionAndRegenerate(newLayers);
    }
    
    // Clean up
    setDraggedLayer(null);
    setDragOverIndex(null);
    setIsDraggingOverLayers(false);
  };

  const handleLayerDragEnd = () => {
    setDraggedLayer(null);
    setDragOverIndex(null);
  };

  // Drag handlers for filters
  const handleFilterDragStart = (e, filter) => {
    setDraggedFilter(filter);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleLayersAreaDragOver = (e) => {
    // Only allow drop if we're dragging a filter (not a layer)
    if (draggedFilter) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingOverLayers(true);
    }
  };

  const handleLayersAreaDragLeave = (e) => {
    // Only set to false if we're leaving the entire layers area
    if (e.currentTarget === e.target) {
      setIsDraggingOverLayers(false);
    }
  };

  const handleLayersAreaDrop = (e, dropIndex = 0) => {
    if (!draggedFilter) return; // Only handle filter drops here
    
    e.preventDefault();
    setIsDraggingOverLayers(false);
    
    // Adding a new filter from available filters
    addLayer(draggedFilter, dropIndex);
    setDraggedFilter(null);
  };

  const handleFilterDragEnd = () => {
    setDraggedFilter(null);
    setIsDraggingOverLayers(false);
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
      }),
      signal: abortControllerRef.current?.signal
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || 'Generation failed');
    }
    
    return await response.json();
  };

  // Process generation queue
  const processGenerationQueue = async () => {
    if (isGeneratingRef.current || generationQueueRef.current.length === 0) {
      return;
    }
    
    isGeneratingRef.current = true;
    abortControllerRef.current = new AbortController();
    
    while (generationQueueRef.current.length > 0) {
      const task = generationQueueRef.current.shift();
      const { cacheKey, inputText, filterId, intensity, layerIds } = task;
      
      // Double-check cache from both state and session storage
      const currentSession = filterSessionManager.loadSession();
      const sessionCache = currentSession?.cache || {};
      
      // Check if already cached (might have been generated while waiting)
      if (cache[cacheKey] || sessionCache[cacheKey]) {
        console.log(`Skipping ${cacheKey} - already cached`);
        // Update local cache if it was in session but not local
        if (sessionCache[cacheKey] && !cache[cacheKey]) {
          setCache(prev => ({ ...prev, [cacheKey]: sessionCache[cacheKey] }));
        }
        continue;
      }
      
      // Mark layers as generating
      setGeneratingLayers(prev => new Set([...prev, ...layerIds]));
      
      try {
        console.log(`Generating ${cacheKey}: ${filterId} at ${intensity}% intensity`);
        const result = await generateFilterStep(inputText, filterId, intensity, selectedModel);
        
        // Update cache
        setCache(prev => ({ ...prev, [cacheKey]: result.text }));
        filterSessionManager.updateCache(cacheKey, result.text);
        
        // Update tokens
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
        
        // Mark layers as no longer generating
        setGeneratingLayers(prev => {
          const newSet = new Set(prev);
          layerIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        
        // Update input for next steps in queue that depend on this result
        generationQueueRef.current.forEach(nextTask => {
          // Check if this task's input should be the result we just generated
          if (nextTask.previousKey === cacheKey) {
            console.log(`Updating input for ${nextTask.cacheKey} to use result from ${cacheKey}`);
            nextTask.inputText = result.text;
          }
        });
        
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('Generation aborted');
          break;
        }
        
        console.error(`Error generating ${cacheKey}:`, error);
        
        setGeneratingLayers(prev => {
          const newSet = new Set(prev);
          layerIds.forEach(id => newSet.delete(id));
          return newSet;
        });
      }
    }
    
    isGeneratingRef.current = false;
    abortControllerRef.current = null;
  };

  // Save session and regenerate
  const saveSessionAndRegenerate = useCallback((newLayers) => {
    // Cancel any ongoing generations
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Load the current session to get the latest cache
    const currentSession = filterSessionManager.loadSession();
    const currentCache = currentSession?.cache || { 'original': originalText.trim() };
    
    // Save session with updated layers and current cache
    filterSessionManager.saveSession({
      originalText: originalText.trim(),
      selectedModel,
      filterStackInitialized: true,
      layers: newLayers,
      cache: currentCache,  // Use the loaded cache
      totalTokens,
      lastModified: new Date().toISOString()
    });
    
    // Calculate what needs to be generated using current cache
    const activeLayers = newLayers.filter(l => l.enabled);
    const plan = calculateGenerationPlan(activeLayers, currentCache);
    
    // Log for debugging
    console.log('Cache keys present:', Object.keys(currentCache));
    console.log('Generation plan:', plan.map(p => p.cacheKey));
    
    // Clear the queue and add new tasks
    generationQueueRef.current = [];
    
    plan.forEach(step => {
      // Find which layers this generation affects
      const affectedLayerIds = [];
      for (let i = step.stepIndex; i < activeLayers.length; i++) {
        affectedLayerIds.push(activeLayers[i].id);
      }
      
      generationQueueRef.current.push({
        ...step,
        layerIds: affectedLayerIds
      });
    });
    
    // Update local cache state to match
    setCache(currentCache);
    
    // Start processing
    processGenerationQueue();
  }, [originalText, selectedModel, totalTokens]);  // Remove cache from dependencies

  // Get layer status
  const getLayerStatus = (layer) => {
    if (!layer.enabled) return 'disabled';
    if (generatingLayers.has(layer.id)) return 'generating';
    
    // Check if this layer's result is cached
    const activeLayers = layers.filter(l => l.enabled);
    const layerIndex = activeLayers.findIndex(l => l.id === layer.id);
    if (layerIndex >= 0) {
      const cacheKey = getCacheKeyForStep(activeLayers, layerIndex);
      if (cache[cacheKey]) return 'complete';
    }
    
    return 'pending';
  };

  const charCount = originalText.length;
  const charCountColor = charCount < 50 ? '#dc3545' : charCount > 1000 ? '#dc3545' : '#28a745';
  const costEstimate = calculateCostEstimate(totalTokens, selectedModel);

  if (!filterStackInitialized) {
    // Initial setup screen
    return (
      <div className={styles.container}>
        <Head>
          <title>Filter Stack - Text Transformer</title>
          <meta name="description" content="Apply Photoshop-like text filters" />
        </Head>
        
        <main className={styles.setupMain}>
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
            Apply Photoshop-like layer filters to transform your text
          </p>
          
          <div className={styles.setupCard}>
            <div className={styles.formGroup}>
              <label htmlFor="originalText" className={styles.label}>
                Your Text
                <span className={styles.charCount} style={{ color: charCountColor }}>
                  {charCount}/1000
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
            
            {errors.length > 0 && (
              <div className={styles.errorContainer}>
                {errors.map((error, index) => (
                  <p key={index} className={styles.error}>{error}</p>
                ))}
              </div>
            )}
            
            {storageWarning && (
              <div className={styles.warningContainer}>
                <p className={styles.warning}>
                  ⚠️ {storageWarning}
                </p>
              </div>
            )}
            
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
              <button onClick={handleInitialize} className={styles.initButton}>
                Start Filtering
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Main filter interface (Photoshop-like)
  return (
    <div className={styles.photoshopContainer}>
      <Head>
        <title>Filter Stack - Text Transformer</title>
      </Head>
      
      <nav className={styles.topNav}>
        <div className={styles.navLinks}>
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
        </div>
        <button 
          onClick={() => {
            filterSessionManager.clearSession();
            window.location.reload();
          }}
          className={styles.startOverBtn}
        >
          Start Over
        </button>
      </nav>
      
      <div className={styles.mainLayout}>
        {/* Left Panel - Layers */}
        <div className={styles.layersPanel}>
          <div className={styles.panelHeader}>
            <h2>Layers</h2>
            <span className={styles.tokenInfo}>
              {totalTokens.input + totalTokens.output} tokens • {costEstimate.formatted}
            </span>
          </div>
          
          {/* Active Layers */}
          <div 
            className={`${styles.layersList} ${isDraggingOverLayers ? styles.draggingOver : ''}`}
            onDragOver={handleLayersAreaDragOver}
            onDragLeave={handleLayersAreaDragLeave}
            onDrop={(e) => handleLayersAreaDrop(e, 0)}
          >
            {layers.length === 0 && (
              <div className={styles.emptyState}>
                {isDraggingOverLayers ? 'Drop here to add layer' : 'Drag filters here or click them below'}
              </div>
            )}
            
            {layers.map((layer, index) => {
              const status = getLayerStatus(layer);
              return (
                <div
                  key={layer.key}
                  className={`${styles.layer} ${styles[status]} ${
                    dragOverIndex === index ? styles.dragOver : ''
                  } ${draggedLayer === index ? styles.dragging : ''}`}
                  draggable="true"
                  onDragStart={(e) => handleLayerDragStart(e, index)}
                  onDragOver={(e) => handleLayerDragOver(e, index)}
                  onDragLeave={(e) => handleLayerDragLeave(e)}
                  onDrop={(e) => handleLayerDrop(e, index)}
                  onDragEnd={handleLayerDragEnd}
                >
                  <div className={styles.dragHandle}>⋮⋮</div>
                  <div className={styles.layerContent}>
                    <div className={styles.layerHeader}>
                      <input
                        type="checkbox"
                        checked={layer.enabled}
                        onChange={() => toggleLayer(layer.id)}
                        className={styles.layerCheckbox}
                      />
                      <span className={styles.layerIcon}>{layer.icon}</span>
                      <span className={styles.layerName}>{layer.name}</span>
                      <div className={styles.layerStatus}>
                        {status === 'generating' && <span className={styles.spinner}>⟳</span>}
                        {status === 'complete' && <span className={styles.check}>✓</span>}
                        {status === 'pending' && <span className={styles.pending}>○</span>}
                      </div>
                      <button
                        onClick={() => removeLayer(layer.id)}
                        className={styles.removeBtn}
                        title="Remove layer"
                      >
                        ×
                      </button>
                    </div>
                    
                    {layer.enabled && (
                      <div className={styles.layerControls}>
                        <input
                          type="range"
                          min="25"
                          max="100"
                          step="25"
                          value={layer.intensity}
                          onChange={(e) => changeLayerIntensity(layer.id, e.target.value)}
                          className={styles.intensitySlider}
                        />
                        <span className={styles.intensityValue}>{layer.intensity}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Available Filters */}
          <div className={styles.availableFilters}>
            <h3>Available Filters</h3>
            <div className={styles.filterGrid}>
              {availableFilters.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => addLayer(filter)}
                  className={styles.filterButton}
                  title={filter.description}
                  draggable
                  onDragStart={(e) => handleFilterDragStart(e, filter)}
                  onDragEnd={handleFilterDragEnd}
                >
                  <span className={styles.filterIcon}>{filter.icon}</span>
                  <span className={styles.filterName}>{filter.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Right Panel - Text Preview */}
        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <h2>Preview</h2>
            <div className={styles.modelInfo}>
              {selectedModel.replace('-', ' ').replace('4.5', ' 4.5').toUpperCase()}
            </div>
          </div>
          
          <div className={styles.textPreview}>
            {currentDisplayText || 'Your text will appear here...'}
          </div>
          
          {/* Generation Status */}
          {generationQueueRef.current.length > 0 && (
            <div className={styles.generationStatus}>
              <div className={styles.generatingIcon}>⟳</div>
              Generating {generationQueueRef.current.length} transformation{generationQueueRef.current.length > 1 ? 's' : ''}...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}