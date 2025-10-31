/**
 * Scroll utility functions
 */

// Cache for max scroll to avoid expensive DOM reads
let cachedMaxScroll = 0
let maxScrollCacheTime = 0
const maxScrollCacheTTL = 100 // Cache for 100ms to reduce DOM reads

/**
 * Cross-browser compatible scroll position getter (optimized)
 * @returns {number} Current scroll position
 */
export function getScrollTop () {
  // Use the most performant method for modern browsers
  return window.pageYOffset || document.documentElement.scrollTop || 0
}

/**
 * Optimized scroll position setter
 * @param {number} position - Scroll position
 */
export function setScrollTop (position) {
  // Use scrollTo for consistent behavior across all documents
  window.scrollTo({
    top: position,
    left: 0,
    behavior: 'auto'
  })
}

/**
 * Optimized scroll height getter with caching
 * @returns {number} Maximum scroll position
 */
export function getMaxScroll () {
  const now = performance.now()

  // Use cached value if still valid
  if (cachedMaxScroll > 0 && (now - maxScrollCacheTime) < maxScrollCacheTTL) {
    return cachedMaxScroll
  }

  // Use consistent calculation for all documents
  cachedMaxScroll = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  ) - window.innerHeight

  maxScrollCacheTime = now
  return cachedMaxScroll
}

/**
 * Invalidate max scroll cache (call when content changes)
 */
export function invalidateMaxScrollCache () {
  cachedMaxScroll = 0
  maxScrollCacheTime = 0
}
