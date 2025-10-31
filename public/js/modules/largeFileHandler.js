/**
 * Large file handling module for markdown files
 * Handles files > 1MB with chunked rendering and progress tracking
 */

const LARGE_FILE_THRESHOLD = 512 * 1024 // 512KB - lower threshold for better UX
const CHUNK_SIZE = 30000 // Process ~30KB at a time (smaller chunks for smoother rendering)
const RENDER_DELAY = 8 // ~120fps, faster updates for large files

/**
 * Check if file is considered large
 * @param {string} markdown - Markdown content
 * @returns {boolean} True if file is large
 */
export function isLargeFile (markdown) {
  return markdown.length > LARGE_FILE_THRESHOLD
}

/**
 * Split markdown into chunks for progressive rendering
 * Tries to split at paragraph boundaries
 * @param {string} markdown - Markdown content
 * @returns {Array<string>} Array of markdown chunks
 */
function splitIntoChunks (markdown) {
  const chunks = []
  let currentChunk = ''
  let currentSize = 0

  // Split by double newlines (paragraphs) or single newlines (lines)
  const lines = markdown.split(/\n/)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineSize = line.length

    // If adding this line would exceed chunk size, save current chunk
    if (currentSize + lineSize > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk)
      currentChunk = line + '\n'
      currentSize = lineSize + 1
    } else {
      currentChunk += line + '\n'
      currentSize += lineSize + 1
    }
  }

  // Add remaining chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

/**
 * Render markdown in chunks for large files
 * Uses incremental DOM updates to prevent UI blocking
 * @param {string} markdown - Markdown content
 * @param {HTMLElement} contentPanel - Content panel element
 * @param {Function} onProgress - Progress callback (chunk, total)
 * @param {Function} onComplete - Completion callback
 */
export async function renderChunked (markdown, contentPanel, onProgress = null, onComplete = null) {
  const chunks = splitIntoChunks(markdown)
  const totalChunks = chunks.length

  // Clear content panel
  contentPanel.innerHTML = ''

  // Create a container for rendered chunks
  const container = document.createElement('div')
  container.className = 'markdown-content'
  contentPanel.appendChild(container)

  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment()
  const FRAGMENT_UPDATE_THRESHOLD = 10 // Update DOM every 10 chunks

  // Process chunks with delays to prevent UI blocking
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]

    // Render chunk to HTML
    const chunkHTML = marked.parse(chunk)

    // Create temporary container to parse HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = chunkHTML

    // Move nodes to fragment
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild)
    }

    // Update DOM periodically to prevent memory buildup
    if (i % FRAGMENT_UPDATE_THRESHOLD === 0 || i === chunks.length - 1) {
      container.appendChild(fragment.cloneNode(true))

      // Clear fragment (but keep nodes in DOM)
      fragment.replaceChildren()

      // Call progress callback
      if (onProgress) {
        onProgress(i + 1, totalChunks)
      }

      // Yield to browser for UI updates
      if (i < chunks.length - 1) {
        await new Promise(resolve => {
          // Use requestIdleCallback if available, otherwise setTimeout
          if (window.requestIdleCallback) {
            requestIdleCallback(() => resolve(), { timeout: RENDER_DELAY })
          } else {
            setTimeout(resolve, RENDER_DELAY)
          }
        })
      }
    }
  }

  // Final fragment append if any remaining
  if (fragment.childNodes.length > 0) {
    container.appendChild(fragment)
  }

  if (onComplete) {
    onComplete()
  }

  return container
}

/**
 * Estimate render time for large file
 * @param {number} fileSize - File size in bytes
 * @returns {number} Estimated render time in milliseconds
 */
export function estimateRenderTime (fileSize) {
  // Rough estimate: ~1ms per 10KB for parsing + rendering
  return Math.max(1000, (fileSize / 10240) * 1)
}

/**
 * Show progress indicator for large file rendering
 * @param {HTMLElement} container - Container element
 * @param {number} current - Current chunk number
 * @param {number} total - Total chunks
 */
export function updateProgressIndicator (container, current, total) {
  let progressBar = container.querySelector('.large-file-progress')

  if (!progressBar) {
    progressBar = document.createElement('div')
    progressBar.className = 'large-file-progress'
    progressBar.innerHTML = `
      <div class="progress-bar-container">
        <div class="progress-bar-fill"></div>
      </div>
      <div class="progress-text">Rendering: <span class="progress-percent">0</span>%</div>
    `
    container.appendChild(progressBar)
  }

  const percent = Math.round((current / total) * 100)
  const fill = progressBar.querySelector('.progress-bar-fill')
  const text = progressBar.querySelector('.progress-percent')

  if (fill) {
    fill.style.setProperty('--progress-width', `${percent}%`)
    fill.style.width = `${percent}%` // Keep for compatibility
  }
  if (text) {
    text.textContent = percent
  }

  // Remove progress bar when complete
  if (current === total) {
    setTimeout(() => {
      if (progressBar && progressBar.parentNode) {
        progressBar.classList.add('progress-fade-out')
        setTimeout(() => {
          if (progressBar.parentNode) {
            progressBar.remove()
          }
        }, 300)
      }
    }, 500)
  }
}
