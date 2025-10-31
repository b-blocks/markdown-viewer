/**
 * Auto-scroll module with State Pattern
 */

import { getScrollTop, setScrollTop, getMaxScroll } from '../utils/scrollUtils.js'
import StateMachine from '../patterns/State.js'
import { eventBus } from '../patterns/Observer.js'

// Auto-scroll states
const AUTO_SCROLL_STATES = {
  STOPPED: 'stopped',
  SCROLLING: 'scrolling',
  AT_BOTTOM: 'at-bottom'
}

// State transitions
const AUTO_SCROLL_TRANSITIONS = {
  [AUTO_SCROLL_STATES.STOPPED]: [AUTO_SCROLL_STATES.SCROLLING],
  [AUTO_SCROLL_STATES.SCROLLING]: [AUTO_SCROLL_STATES.STOPPED, AUTO_SCROLL_STATES.AT_BOTTOM],
  [AUTO_SCROLL_STATES.AT_BOTTOM]: [AUTO_SCROLL_STATES.SCROLLING, AUTO_SCROLL_STATES.STOPPED]
}

let autoScrollAnimationId = null
let scrollRafId = null
let lastScrollTop = 0
let lastMaxScroll = 0
let scrollListenerAdded = false

const scrollSpeed = 1 // pixels per frame
const scrollThrottle = 16 // ~60fps throttling
let lastScrollTime = 0
let scrollAccumulator = 0

let autoScrollBtn = null
let stateMachine = null

/**
 * Handle scroll events
 */
function handleScroll () {
  const currentScroll = getScrollTop()

  // Only check max scroll occasionally to reduce DOM reads
  // Use cached value if available
  const maxScroll = getMaxScroll()

  // Only update if scroll position or max scroll changed significantly
  if (Math.abs(currentScroll - lastScrollTop) < 1 && Math.abs(maxScroll - lastMaxScroll) < 1) {
    return
  }

  lastScrollTop = currentScroll
  lastMaxScroll = maxScroll

  if (currentScroll >= maxScroll - 10) {
    if (stateMachine.getState() === AUTO_SCROLL_STATES.SCROLLING) {
      stateMachine.transition(AUTO_SCROLL_STATES.AT_BOTTOM)
    } else if (stateMachine.getState() !== AUTO_SCROLL_STATES.AT_BOTTOM) {
      stateMachine.transition(AUTO_SCROLL_STATES.AT_BOTTOM)
    }
  } else {
    if (stateMachine.getState() === AUTO_SCROLL_STATES.AT_BOTTOM) {
      stateMachine.transition(AUTO_SCROLL_STATES.STOPPED)
    }
  }
}

/**
 * Stop auto-scroll if user manually scrolls with the wheel
 */
function handleWheelScroll () {
  if (stateMachine.getState() === AUTO_SCROLL_STATES.SCROLLING) {
    stateMachine.transition(AUTO_SCROLL_STATES.STOPPED)
  }
}

/**
 * Unified scroll handler using requestAnimationFrame
 */
function handleUnifiedScroll () {
  // Use requestAnimationFrame to throttle scroll events
  if (scrollRafId === null) {
    scrollRafId = requestAnimationFrame(() => {
      handleScroll()
      scrollRafId = null
    })
  }
}

/**
 * Start auto-scroll
 */
function startAutoScroll () {
  if (stateMachine.getState() === AUTO_SCROLL_STATES.SCROLLING) return

  if (!stateMachine.transition(AUTO_SCROLL_STATES.SCROLLING)) {
    return
  }

  lastScrollTime = performance.now()
  scrollAccumulator = 0

  // Counter to periodically check max scroll (not every frame)
  let maxScrollCheckCounter = 0
  const maxScrollCheckInterval = 5 // Check every 5 frames

  function autoScrollFrame () {
    if (stateMachine.getState() !== AUTO_SCROLL_STATES.SCROLLING) return

    const now = performance.now()
    const deltaTime = now - lastScrollTime

    // Throttle to ~60fps
    if (deltaTime < scrollThrottle) {
      autoScrollAnimationId = requestAnimationFrame(autoScrollFrame)
      return
    }

    const currentScroll = getScrollTop()

    // Only check max scroll periodically
    maxScrollCheckCounter++
    let maxScroll
    if (maxScrollCheckCounter >= maxScrollCheckInterval) {
      maxScroll = getMaxScroll() // Refresh cache
      maxScrollCheckCounter = 0
    } else {
      // Use cached value - getMaxScroll() already uses internal cache
      maxScroll = getMaxScroll()
    }

    // Stop if reached bottom
    const bottomThreshold = 10
    if (currentScroll >= maxScroll - bottomThreshold) {
      stateMachine.transition(AUTO_SCROLL_STATES.AT_BOTTOM)
      return
    }

    // Batch scroll updates - accumulate scroll distance
    scrollAccumulator += scrollSpeed

    // Only update DOM when we have accumulated enough scroll
    const updateThreshold = 1
    if (scrollAccumulator >= updateThreshold) {
      const scrollAmount = Math.floor(scrollAccumulator)
      // Use requestAnimationFrame to batch the scroll update
      // This helps browser optimize layout calculations
      setScrollTop(currentScroll + scrollAmount)
      scrollAccumulator -= scrollAmount
    }

    lastScrollTime = now
    autoScrollAnimationId = requestAnimationFrame(autoScrollFrame)
  }

  autoScrollAnimationId = requestAnimationFrame(autoScrollFrame)
}

/**
 * Stop auto-scroll
 */
export function stopAutoScroll () {
  if (stateMachine.getState() === AUTO_SCROLL_STATES.STOPPED) return

  stateMachine.transition(AUTO_SCROLL_STATES.STOPPED)

  if (autoScrollAnimationId) {
    cancelAnimationFrame(autoScrollAnimationId)
    autoScrollAnimationId = null
  }
}

/**
 * Toggle auto-scroll
 */
function toggleAutoScroll () {
  const currentState = stateMachine.getState()
  if (currentState === AUTO_SCROLL_STATES.SCROLLING) {
    stopAutoScroll()
  } else {
    if (currentState === AUTO_SCROLL_STATES.AT_BOTTOM) {
      stateMachine.transition(AUTO_SCROLL_STATES.STOPPED)
    }
    startAutoScroll()
  }
}

/**
 * Update UI based on state
 */
function updateUIFromState (state) {
  if (!autoScrollBtn) return

  // Remove all state classes
  autoScrollBtn.classList.remove('scrolling', 'at-bottom')

  switch (state) {
    case AUTO_SCROLL_STATES.SCROLLING:
      autoScrollBtn.classList.add('scrolling')
      autoScrollBtn.title = 'Stop Auto Scroll'
      break
    case AUTO_SCROLL_STATES.AT_BOTTOM:
      autoScrollBtn.classList.add('at-bottom')
      autoScrollBtn.title = 'Auto Scroll'
      break
    case AUTO_SCROLL_STATES.STOPPED:
    default:
      autoScrollBtn.title = 'Auto Scroll'
      break
  }
}

/**
 * Initialize auto-scroll module
 * @param {HTMLElement} btn - Auto-scroll button element
 */
export function initAutoScroll (btn) {
  autoScrollBtn = btn

  // Initialize state machine
  stateMachine = new StateMachine(AUTO_SCROLL_STATES.STOPPED, AUTO_SCROLL_TRANSITIONS)

  // Listen to state changes and update UI
  stateMachine.onStateChange(({ to }) => {
    updateUIFromState(to)
    eventBus.emit('autoscroll:state-changed', { state: to })
  })

  // Event listeners for auto-scroll button
  if (autoScrollBtn) {
    autoScrollBtn.addEventListener('click', toggleAutoScroll)
  }

  // Single scroll event listener (only add if not already added)
  if (!scrollListenerAdded) {
    window.addEventListener('scroll', handleUnifiedScroll, { passive: true })
    scrollListenerAdded = true
  }

  // Wheel event for immediate response
  window.addEventListener('wheel', handleWheelScroll, { passive: true })
}

/**
 * Disable scroll handling temporarily
 */
export function disableScrollHandling () {
  window.removeEventListener('scroll', handleUnifiedScroll)
}

/**
 * Enable scroll handling
 */
export function enableScrollHandling () {
  if (!scrollListenerAdded) {
    window.addEventListener('scroll', handleUnifiedScroll, { passive: true })
    scrollListenerAdded = true
  }
}

/**
 * Update scroll state after content load
 */
export function updateScrollState () {
  requestAnimationFrame(() => {
    window.scrollTo(0, 0)
    handleScroll()
  })
}

/**
 * Cleanup auto-scroll module
 */
export function cleanupAutoScroll () {
  stopAutoScroll()

  if (scrollRafId) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }

  window.removeEventListener('scroll', handleUnifiedScroll)
  window.removeEventListener('wheel', handleWheelScroll)
}
