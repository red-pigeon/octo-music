/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { ref } from 'vue'

const CACHE_KEY_PREFIX = 'octoPlayer.cache.v1'

/**
 * Composable for localStorage caching of page data.
 * 
 * Provides simple save/load/refresh functionality for any page
 * that fetches data from the server.
 * 
 * @param {string} cacheKey - Unique identifier for this cache (e.g., 'favorites', 'mymusic')
 * @returns {Object} Cache methods and state
 */
export function useSessionCache(cacheKey) {
  const cacheTimestamp = ref(null)
  const isFromCache = ref(false)
  const isBackgroundRefreshing = ref(false)
  const hasBackgroundUpdate = ref(false)

  /**
   * Get the full cache key for localStorage
   */
  function getCacheStorageKey() {
    return `${CACHE_KEY_PREFIX}.${cacheKey}`
  }

  /**
   * Save data to localStorage
   * 
   * @param {any} data - Data to cache (will be JSON.stringify'd)
   * @returns {boolean} True if save was successful
   */
  function save(data) {
    if (typeof localStorage === 'undefined') return false
    
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
      }
      
      localStorage.setItem(getCacheStorageKey(), JSON.stringify(cacheData))
      cacheTimestamp.value = cacheData.timestamp
      console.log(`[useSessionCache:${cacheKey}] Saved to cache`)
      return true
    } catch (err) {
      // Quota exceeded or other error - just continue without cache
      console.warn(`[useSessionCache:${cacheKey}] Failed to save cache:`, err)
      return false
    }
  }

  /**
   * Load data from localStorage
   * 
   * @returns {any|null} Cached data or null if not found/invalid
   */
  function load() {
    if (typeof localStorage === 'undefined') return null
    
    try {
      const raw = localStorage.getItem(getCacheStorageKey())
      if (!raw) return null
      
      const cacheData = JSON.parse(raw)
      
      // Validate cache structure
      if (!cacheData || typeof cacheData !== 'object' || !cacheData.data) {
        return null
      }
      
      cacheTimestamp.value = cacheData.timestamp || null
      isFromCache.value = true
      
      console.log(`[useSessionCache:${cacheKey}] Loaded from cache`)
      return cacheData.data
    } catch (err) {
      console.warn(`[useSessionCache:${cacheKey}] Failed to load cache:`, err)
      return null
    }
  }

  /**
   * Clear the cache
   */
  function clear() {
    if (typeof localStorage === 'undefined') return
    
    try {
      localStorage.removeItem(getCacheStorageKey())
      cacheTimestamp.value = null
      isFromCache.value = false
      console.log(`[useSessionCache:${cacheKey}] Cleared cache`)
    } catch (err) {
      console.warn(`[useSessionCache:${cacheKey}] Failed to clear cache:`, err)
    }
  }

  /**
   * Force refresh: clear cache and execute fetch function
   * 
   * @param {Function} fetchFn - Async function to fetch fresh data
   * @returns {Promise<any>} Result from fetchFn
   */
  async function refresh(fetchFn) {
    clear()
    isFromCache.value = false
    const result = await fetchFn()
    return result
  }

  /**
   * Get cache age in seconds (null if no cache)
   * 
   * @returns {number|null}
   */
  function getCacheAge() {
    if (!cacheTimestamp.value) return null
    return Math.floor((Date.now() - cacheTimestamp.value) / 1000)
  }

  /**
   * Check if cache exists
   * 
   * @returns {boolean}
   */
  function hasCache() {
    if (typeof localStorage === 'undefined') return false
    try {
      const raw = localStorage.getItem(getCacheStorageKey())
      return !!raw
    } catch {
      return false
    }
  }

  /**
   * Load from cache immediately, then check server in background
   * 
   * @param {Function} fetchFn - Async function to fetch fresh data
   * @param {Function} compareFn - Function to compare cached vs fresh data, returns true if different
   * @param {Function} onUpdate - Callback when fresh data is different (receives fresh data)
   * @returns {any|null} Cached data or null
   */
  function loadWithBackgroundCheck(fetchFn, compareFn, onUpdate) {
    // Load from cache immediately
    const cached = load()
    
    // Start background check
    if (fetchFn) {
      isBackgroundRefreshing.value = true
      hasBackgroundUpdate.value = false
      
      fetchFn()
        .then(fresh => {
          // Compare cached vs fresh
          const isDifferent = compareFn ? compareFn(cached, fresh) : JSON.stringify(cached) !== JSON.stringify(fresh)
          
          if (isDifferent) {
            console.log(`[useSessionCache:${cacheKey}] Background refresh detected changes`)
            hasBackgroundUpdate.value = true
            
            // Save fresh data to cache
            save(fresh)
            
            // Notify caller
            if (onUpdate) {
              onUpdate(fresh)
            }
          } else {
            console.log(`[useSessionCache:${cacheKey}] Background refresh: no changes`)
          }
        })
        .catch(err => {
          console.warn(`[useSessionCache:${cacheKey}] Background refresh failed:`, err)
        })
        .finally(() => {
          isBackgroundRefreshing.value = false
        })
    }
    
    return cached
  }

  /**
   * Reset background update flag
   */
  function clearBackgroundUpdateFlag() {
    hasBackgroundUpdate.value = false
  }

  return {
    // State
    cacheTimestamp,
    isFromCache,
    isBackgroundRefreshing,
    hasBackgroundUpdate,
    
    // Methods
    save,
    load,
    clear,
    refresh,
    getCacheAge,
    hasCache,
    loadWithBackgroundCheck,
    clearBackgroundUpdateFlag,
  }
}
