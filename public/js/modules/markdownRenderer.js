/**
 * Markdown rendering module with Strategy Pattern
 */

import { Renderer, MarkdownRenderingStrategy } from '../patterns/Strategy.js'
import DOMFactory from '../patterns/Factory.js'
import { isLargeFile, renderChunked, updateProgressIndicator, estimateRenderTime } from './largeFileHandler.js'

// Renderer instance with markdown strategy
const renderer = new Renderer(new MarkdownRenderingStrategy())

/**
 * Generate Table of Contents from headings
 * @param {HTMLElement} contentPanel - Content panel element
 * @param {HTMLElement} tocPanel - TOC panel element
 */
export function generateToc (contentPanel, tocPanel) {
  const headings = contentPanel.querySelectorAll('h1, h2, h3, h4, h5, h6')
  if (headings.length === 0) {
    tocPanel.innerHTML = '<p>No headings found.</p>'
    return
  }

  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment()
  const tocList = document.createElement('ul')

  // Process headings in batch
  const tocItems = []
  const usedIds = new Set() // Cache used IDs for O(1) lookup instead of O(n) DOM queries

  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.substring(1), 10)

    // Create a more robust, text-based ID (a "slug")
    const text = heading.textContent
    const slug = text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
    let id = slug

    // Ensure the ID is unique on the page using Set for O(1) lookup
    let counter = 1
    while (usedIds.has(id)) {
      id = `${slug}-${counter++}`
    }
    usedIds.add(id)
    heading.id = id

    // Use Factory Pattern to create TOC item
    const tocItem = DOMFactory.createTocItem(heading, level)
    tocItems.push(tocItem)
  })

  // Batch append all items at once
  tocItems.forEach(item => tocList.appendChild(item))
  fragment.appendChild(tocList)

  // Single DOM update
  tocPanel.innerHTML = ''
  tocPanel.appendChild(fragment)
}

/**
 * Make tables responsive for mobile
 * @param {HTMLElement} contentPanel - Content panel element
 */
export function makeTablesResponsive (contentPanel) {
  const tables = contentPanel.querySelectorAll('table')

  tables.forEach(table => {
    const headers = table.querySelectorAll('th')
    const rows = table.querySelectorAll('tbody tr')

    // Add data-label attributes to table cells for mobile display
    rows.forEach(row => {
      const cells = row.querySelectorAll('td')
      cells.forEach((cell, index) => {
        if (headers[index]) {
          cell.setAttribute('data-label', headers[index].textContent.trim())
        }
      })
    })
  })
}

/**
 * Render markdown content to HTML using Strategy Pattern
 * Optimized for large files (>1MB) with chunked rendering
 * @param {string} markdown - Markdown content
 * @param {HTMLElement} contentPanel - Content panel element
 * @param {HTMLElement} tocPanel - TOC panel element
 * @param {Function} onRenderComplete - Callback when rendering is complete
 */
export async function renderMarkdown (markdown, contentPanel, tocPanel, onRenderComplete) {
  const fileSize = markdown.length
  const isLarge = isLargeFile(markdown)

  if (isLarge) {
    console.log(`Large file detected (${(fileSize / 1024 / 1024).toFixed(2)} MB). Using chunked rendering...`)
    const estimatedTime = estimateRenderTime(fileSize)
    console.log(`Estimated render time: ~${(estimatedTime / 1000).toFixed(1)}s`)

    // Create progress container
    const progressContainer = document.createElement('div')
    progressContainer.className = 'large-file-progress-container'
    document.body.appendChild(progressContainer)

    // Render in chunks with progress updates
    await renderChunked(markdown, contentPanel, (current, total) => {
      updateProgressIndicator(progressContainer, current, total)
    }, () => {
      // Remove progress indicator
      setTimeout(() => {
        if (progressContainer.parentNode) {
          progressContainer.remove()
        }
      }, 500)

      // Process TOC and tables after rendering
      requestAnimationFrame(() => {
        generateToc(contentPanel, tocPanel)
        makeTablesResponsive(contentPanel)

        if (onRenderComplete) {
          onRenderComplete()
        }
      })
    })
  } else {
    // Small file: render normally
    renderer.render(markdown, contentPanel)

    // Generate Table of Contents
    generateToc(contentPanel, tocPanel)

    // Make tables responsive for mobile
    makeTablesResponsive(contentPanel)

    // Call completion callback
    if (onRenderComplete) {
      onRenderComplete()
    }
  }
}
