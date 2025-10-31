/**
 * Main application entry point
 */

import { initStyles } from './modules/styles.js'
import { populateFileSelector, loadMarkdownContent } from './modules/fileLoader.js'
import { renderMarkdown } from './modules/markdownRenderer.js'
import { initLazySyntaxHighlighting, cleanupSyntaxHighlighting } from './modules/syntaxHighlighting.js'
import {
  initAutoScroll,
  stopAutoScroll,
  disableScrollHandling,
  enableScrollHandling,
  updateScrollState,
  cleanupAutoScroll
} from './modules/autoScroll.js'
import {
  initMemoSystem,
  cleanupMemoSystem,
  addMemo,
  loadMemos,
  showAddMemoDialog
} from './modules/memoSystem.js'
import { invalidateMaxScrollCache } from './utils/scrollUtils.js'
import DOMFactory from './patterns/Factory.js'
import { eventBus } from './patterns/Observer.js'

document.addEventListener('DOMContentLoaded', () => {
  // Initialize styles
  initStyles()

  // Get DOM elements
  const fileSelector = document.getElementById('fileSelector')
  const fileSelectorContainer = document.getElementById('file-selector-container')
  const tocPanel = document.getElementById('toc-panel')
  const contentPanel = document.getElementById('content-panel')
  const autoScrollBtn = document.getElementById('autoScrollBtn')
  const memoBtn = document.getElementById('memoBtn')

  // Initialize auto-scroll
  if (autoScrollBtn) {
    initAutoScroll(autoScrollBtn)
  }

  // Initialize memo system with callback
  const memoList = document.getElementById('memoList')
  const addMemoBtn = document.getElementById('addMemoBtn')
  const addMemoCallback = (content) => {
    if (memoList) {
      addMemo(content, fileSelector.value, memoList)
    } else {
      // If memoList doesn't exist (e.g., on memos.html), just add to localStorage
      try {
        const memos = JSON.parse(localStorage.getItem('memos') || '[]')
        const newMemo = {
          id: Date.now(),
          content,
          timestamp: new Date().toISOString(),
          fileUrl: fileSelector.value || ''
        }
        memos.push(newMemo)
        localStorage.setItem('memos', JSON.stringify(memos))
      } catch (error) {
        console.error('Error saving memo to localStorage:', error)
        alert('메모 저장 중 오류가 발생했습니다.')
      }
    }
  }
  initMemoSystem(memoBtn, contentPanel, addMemoCallback, memoList)

  // Set up add memo button handler
  if (addMemoBtn && memoList) {
    addMemoBtn.addEventListener('click', () => {
      showAddMemoDialog(addMemoCallback)
    })
  }

  // Load initial memos
  if (memoList) {
    loadMemos(memoList)
  }

  /**
   * Load markdown file
   * @param {string} url - Optional URL to load, uses fileSelector value if not provided
   */
  async function loadMarkdown (url) {
    if (!fileSelector || !contentPanel || !tocPanel) return

    if (!url && fileSelector.options.length > 0) {
      url = fileSelector.value
    } else if (!url) {
      contentPanel.innerHTML = '<p>No file selected.</p>'
      return
    }

    // Temporarily disable scroll handling to prevent race conditions during content replacement
    disableScrollHandling()

    // Stop auto-scroll when loading new content
    stopAutoScroll()

    // Clear previous content using Factory Pattern
    contentPanel.innerHTML = ''
    contentPanel.appendChild(DOMFactory.createLoadingSpinner('Loading markdown file...'))
    tocPanel.innerHTML = ''

    try {
      const startTime = performance.now()

      // Fetch markdown from our server endpoint
      const markdown = await loadMarkdownContent(url)

      const fetchTime = performance.now() - startTime
      console.log(`Fetched markdown in ${fetchTime.toFixed(2)}ms (${(markdown.length / 1024).toFixed(2)} KB)`)

      // Show rendering progress using Factory Pattern
      contentPanel.innerHTML = ''
      contentPanel.appendChild(DOMFactory.createLoadingSpinner('Rendering markdown...'))

      // Use requestAnimationFrame to prevent blocking the UI
      requestAnimationFrame(async () => {
        const renderStart = performance.now()

        // Render markdown to HTML (now supports async for large files)
        await renderMarkdown(markdown, contentPanel, tocPanel, () => {
          // Initialize lazy syntax highlighting
          initLazySyntaxHighlighting(contentPanel)

          // Invalidate scroll cache when new content is loaded
          invalidateMaxScrollCache()

          const renderTime = performance.now() - renderStart
          console.log(`Rendered HTML in ${renderTime.toFixed(2)}ms`)

          const totalTime = performance.now() - startTime
          console.log(`Total load time: ${totalTime.toFixed(2)}ms`)
          console.log(`File size: ${(markdown.length / 1024 / 1024).toFixed(2)} MB`)

          // Re-enable scroll handling after content is fully loaded
          enableScrollHandling()

          // Explicitly reset scroll position and update button state to avoid race conditions
          updateScrollState()
        })
      })
    } catch (error) {
      // Use Factory Pattern for error display
      contentPanel.innerHTML = ''
      contentPanel.appendChild(DOMFactory.createErrorElement(error.message))
      eventBus.emit('markdown:load-error', { error: error.message })
    }
  }

  // Initialize the application
  if (fileSelectorContainer && fileSelector) {
    populateFileSelector(fileSelectorContainer, fileSelector, () => loadMarkdown())
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    cleanupMemoSystem()
    cleanupSyntaxHighlighting()
    cleanupAutoScroll()
  })
})
