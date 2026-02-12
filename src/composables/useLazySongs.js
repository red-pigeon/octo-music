/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { ref, computed } from 'vue'

const CACHE_KEY_PREFIX = 'octoPlayer.songsCache.v1'

/**
 * Composable for lazy loading songs with virtual scroll support.
 * 
 * Instead of loading all songs upfront, this loads chunks on-demand
 * as the user scrolls. Supports jumping to any position.
 * 
 * Now includes localStorage caching for instant subsequent loads.
 */
export function useLazySongs(options = {}) {
  const {
    chunkSize = 500,
    prefetchChunks = 1,
    fetchFn = null, // async (startIndex, limit, filters) => { items, totalCount }
    cacheKey = 'default', // Unique key for this cache (e.g., 'songs', 'favorites')
  } = options

  // Sparse storage: Map<index, track>
  const itemsMap = new Map()
  
  // Track which chunks are loaded/loading
  const loadedChunks = new Set()
  const loadingChunks = new Set()
  
  // Reactive state
  const totalCount = ref(null)
  const isInitialized = ref(false)
  const error = ref('')
  const cacheTimestamp = ref(null)
  const isBackgroundRefreshing = ref(false)
  const hasBackgroundUpdate = ref(false)
  
  // Current filter state (for cache invalidation)
  const currentFilters = ref({ letter: 'All', search: '' })
  
  // Reactive trigger for UI updates when items change
  const itemsVersion = ref(0)
  
  // Items as a computed sparse array (for compatibility)
  const items = computed(() => {
    // Touch version to make this reactive
    void itemsVersion.value
    
    if (totalCount.value === null) return []
    
    // Return a proxy-like array that returns items from the map
    const result = new Array(totalCount.value)
    for (const [idx, item] of itemsMap.entries()) {
      result[idx] = item
    }
    return result
  })
  
  // Track how many items are actually loaded
  const loadedCount = computed(() => {
    void itemsVersion.value
    return itemsMap.size
  })
  
  // Check if fully loaded
  const isFullyLoaded = computed(() => {
    if (totalCount.value === null) return false
    return loadedCount.value >= totalCount.value
  })

  /**
   * Get the full cache key for localStorage
   */
  function getCacheStorageKey() {
    return `${CACHE_KEY_PREFIX}.${cacheKey}`
  }

  /**
   * Save current state to localStorage
   */
  function saveToCache() {
    if (typeof localStorage === 'undefined') return
    
    try {
      const data = {
        items: Array.from(itemsMap.entries()),
        totalCount: totalCount.value,
        loadedChunks: Array.from(loadedChunks),
        filters: currentFilters.value,
        timestamp: Date.now(),
      }
      
      localStorage.setItem(getCacheStorageKey(), JSON.stringify(data))
    } catch (err) {
      // Quota exceeded or other error - just continue without cache
      console.warn('Failed to save songs cache:', err)
    }
  }

  /**
   * Load state from localStorage
   * Returns true if cache was restored, false otherwise
   */
  function loadFromCache() {
    if (typeof localStorage === 'undefined') return false
    
    try {
      const raw = localStorage.getItem(getCacheStorageKey())
      if (!raw) return false
      
      const data = JSON.parse(raw)
      
      // Validate cache structure
      if (!data || !Array.isArray(data.items) || typeof data.totalCount !== 'number') {
        return false
      }
      
      // Restore data
      itemsMap.clear()
      data.items.forEach(([idx, item]) => {
        itemsMap.set(idx, item)
      })
      
      totalCount.value = data.totalCount
      
      loadedChunks.clear()
      if (Array.isArray(data.loadedChunks)) {
        data.loadedChunks.forEach(chunk => loadedChunks.add(chunk))
      }
      
      if (data.filters) {
        currentFilters.value = data.filters
      }
      
      cacheTimestamp.value = data.timestamp || null
      isInitialized.value = true
      itemsVersion.value++
      
      console.log(`[useLazySongs] Loaded ${itemsMap.size} items from cache`)
      return true
    } catch (err) {
      console.warn('Failed to load songs cache:', err)
      return false
    }
  }

  /**
   * Clear localStorage cache
   */
  function clearStoredCache() {
    if (typeof localStorage === 'undefined') return

    try {
      localStorage.removeItem(getCacheStorageKey())
      cacheTimestamp.value = null
    } catch (err) {
      console.warn('Failed to clear songs cache:', err)
    }
  }

  /**
   * Clear all cached data (e.g., when filters change)
   */
  function clearCache() {
    itemsMap.clear()
    loadedChunks.clear()
    loadingChunks.clear()
    itemsVersion.value++
  }

  /**
   * Initialize and get total count
   * Will attempt to load from cache first
   */
  async function initialize(filters = {}, { skipCache = false } = {}) {
    if (!fetchFn) {
      error.value = 'No fetch function provided'
      return
    }
    
    error.value = ''
    
    // Check if filters changed - invalidate cache if so
    const filtersKey = JSON.stringify(filters)
    const currentFiltersKey = JSON.stringify(currentFilters.value)
    
    if (filtersKey !== currentFiltersKey) {
      clearCache()
      clearStoredCache()
      currentFilters.value = filters
      totalCount.value = null
    }
    
    // Try to load from cache unless explicitly skipped
    if (!skipCache && loadFromCache()) {
      return
    }
    
    try {
      // Fetch first chunk to get total count
      const result = await fetchFn(0, chunkSize, filters)
      
      totalCount.value = result.totalCount ?? 0
      
      // Store the items
      if (result.items?.length) {
        result.items.forEach((item, idx) => {
          itemsMap.set(idx, item)
        })
        loadedChunks.add(0)
        itemsVersion.value++
      }
      
      isInitialized.value = true
      
      // Save to cache
      saveToCache()
    } catch (err) {
      error.value = `Failed to initialize: ${err?.message || String(err)}`
    }
  }

  /**
   * Get the chunk index for a given item index
   */
  function getChunkIndex(itemIndex) {
    return Math.floor(itemIndex / chunkSize)
  }

  /**
   * Load a specific chunk
   */
  async function loadChunk(chunkIndex, filters = null) {
    if (!fetchFn) return
    
    const effectiveFilters = filters ?? currentFilters.value
    
    // Already loaded or loading?
    if (loadedChunks.has(chunkIndex) || loadingChunks.has(chunkIndex)) {
      return
    }
    
    // Check bounds
    if (totalCount.value !== null) {
      const maxChunk = Math.ceil(totalCount.value / chunkSize) - 1
      if (chunkIndex > maxChunk || chunkIndex < 0) return
    }
    
    loadingChunks.add(chunkIndex)
    
    try {
      const startIndex = chunkIndex * chunkSize
      const result = await fetchFn(startIndex, chunkSize, effectiveFilters)
      
      // Update total if changed
      if (result.totalCount !== undefined && result.totalCount !== totalCount.value) {
        totalCount.value = result.totalCount
      }
      
      // Store items
      if (result.items?.length) {
        result.items.forEach((item, idx) => {
          itemsMap.set(startIndex + idx, item)
        })
      }
      
      loadedChunks.add(chunkIndex)
      itemsVersion.value++
      
      // Update cache
      saveToCache()
    } catch (err) {
      error.value = `Failed to load chunk ${chunkIndex}: ${err?.message || String(err)}`
    } finally {
      loadingChunks.delete(chunkIndex)
    }
  }

  /**
   * Ensure a range of indices is loaded (with prefetch)
   */
  async function ensureRange(startIndex, endIndex, filters = null) {
    if (totalCount.value === null) return
    
    const startChunk = Math.max(0, getChunkIndex(startIndex) - prefetchChunks)
    const endChunk = getChunkIndex(endIndex) + prefetchChunks
    
    const chunksToLoad = []
    
    for (let i = startChunk; i <= endChunk; i++) {
      if (!loadedChunks.has(i) && !loadingChunks.has(i)) {
        chunksToLoad.push(i)
      }
    }
    
    // Load chunks in parallel (but limit concurrency)
    const maxConcurrent = 3
    for (let i = 0; i < chunksToLoad.length; i += maxConcurrent) {
      const batch = chunksToLoad.slice(i, i + maxConcurrent)
      await Promise.all(batch.map(chunk => loadChunk(chunk, filters)))
    }
  }

  /**
   * Load all remaining chunks (for operations that need all data)
   */
  async function loadAll(filters = null) {
    if (totalCount.value === null) {
      await initialize(filters ?? currentFilters.value)
    }
    
    if (totalCount.value === null || totalCount.value === 0) return
    
    const maxChunk = Math.ceil(totalCount.value / chunkSize) - 1
    const chunksToLoad = []
    
    for (let i = 0; i <= maxChunk; i++) {
      if (!loadedChunks.has(i) && !loadingChunks.has(i)) {
        chunksToLoad.push(i)
      }
    }
    
    // Load in batches
    const maxConcurrent = 3
    for (let i = 0; i < chunksToLoad.length; i += maxConcurrent) {
      const batch = chunksToLoad.slice(i, i + maxConcurrent)
      await Promise.all(batch.map(chunk => loadChunk(chunk, filters)))
    }
  }

  /**
   * Get an item by index (may be undefined if not loaded)
   */
  function getItem(index) {
    return itemsMap.get(index)
  }

  /**
   * Check if an index is loaded
   */
  function isLoaded(index) {
    return itemsMap.has(index)
  }

  /**
   * Check if a chunk is loaded
   */
  function isChunkLoaded(chunkIndex) {
    return loadedChunks.has(chunkIndex)
  }

  /**
   * Check if a chunk is currently loading
   */
  function isChunkLoading(chunkIndex) {
    return loadingChunks.has(chunkIndex)
  }

  /**
   * Get loaded items as array (only loaded items, no holes)
   */
  function getLoadedItems() {
    void itemsVersion.value
    return Array.from(itemsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, item]) => item)
  }

  /**
   * Update filters and reload
   */
  async function updateFilters(filters) {
    await initialize(filters)
  }

  /**
   * Update a single item in the cache (for favorite toggles, etc.)
   */
  function updateItem(itemId, updateFn) {
    for (const [idx, item] of itemsMap.entries()) {
      if (item?.Id === itemId) {
        itemsMap.set(idx, updateFn(item))
        itemsVersion.value++
        // Update cache after modification
        saveToCache()
        break
      }
    }
  }

  /**
   * Find item index by ID (returns -1 if not loaded or not found)
   */
  function findIndexById(itemId) {
    for (const [idx, item] of itemsMap.entries()) {
      if (item?.Id === itemId) {
        return idx
      }
    }
    return -1
  }

  /**
   * Force refresh from server (bypass cache)
   */
  async function refresh() {
    clearCache()
    clearStoredCache()
    await initialize(currentFilters.value, { skipCache: true })
  }

  /**
   * Clear background update flag
   */
  function clearBackgroundUpdateFlag() {
    hasBackgroundUpdate.value = false
  }

  return {
    // State
    items,
    totalCount,
    loadedCount,
    isInitialized,
    isFullyLoaded,
    error,
    itemsVersion,
    cacheTimestamp,
    isBackgroundRefreshing,
    hasBackgroundUpdate,
    
    // Methods
    initialize,
    ensureRange,
    loadAll,
    loadChunk,
    getItem,
    isLoaded,
    isChunkLoaded,
    isChunkLoading,
    getChunkIndex,
    getLoadedItems,
    updateFilters,
    updateItem,
    findIndexById,
    clearCache,
    refresh,
    clearBackgroundUpdateFlag,
  }
}
