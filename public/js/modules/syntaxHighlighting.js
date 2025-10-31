/**
 * Lazy syntax highlighting module using IntersectionObserver
 */

let syntaxHighlightObserver = null
let codeBlockDataArray = [] // Store code block data for lazy highlighting

/**
 * Initialize lazy syntax highlighting
 * @param {HTMLElement} contentPanel - Content panel element
 */
export function initLazySyntaxHighlighting (contentPanel) {
  // Clean up existing observer if any
  if (syntaxHighlightObserver) {
    syntaxHighlightObserver.disconnect()
    syntaxHighlightObserver = null
  }

  const codeBlocks = contentPanel.querySelectorAll('pre code')
  if (codeBlocks.length === 0) return

  // Reset array
  codeBlockDataArray = []

  // Store original code and language info for each code block
  codeBlocks.forEach((codeElement, index) => {
    const preElement = codeElement.parentElement

    // Extract language from code element class or pre element class
    // marked.js adds language classes to code elements
    const codeClassName = codeElement.className || ''
    const preClassName = preElement.className || ''
    const combinedClass = `${codeClassName} ${preClassName}`

    // Extract language from class name (e.g., "language-javascript" -> "javascript")
    const langMatch = combinedClass.match(/language-(\w+)/)
    const lang = langMatch ? langMatch[1] : null

    // Store original code content and language
    const originalCode = codeElement.textContent
    codeElement.setAttribute('data-original-code', originalCode)
    codeElement.setAttribute('data-lang', lang || '')
    codeElement.setAttribute('data-highlighted', 'false')
    codeElement.setAttribute('data-index', index.toString())

    codeBlockDataArray.push({
      element: codeElement,
      preElement,
      lang,
      originalCode,
      index
    })
  })

  // Highlight first 5 code blocks immediately for perceived performance
  const immediateHighlightCount = Math.min(5, codeBlockDataArray.length)
  const highlightStart = performance.now()

  for (let i = 0; i < immediateHighlightCount; i++) {
    highlightCodeBlock(codeBlockDataArray[i])
  }

  const immediateHighlightTime = performance.now() - highlightStart
  console.log(`Highlighted first ${immediateHighlightCount} code blocks in ${immediateHighlightTime.toFixed(2)}ms`)

  // Use IntersectionObserver for lazy highlighting of remaining blocks
  if (codeBlockDataArray.length > immediateHighlightCount) {
    syntaxHighlightObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const codeElement = entry.target
          const index = parseInt(codeElement.getAttribute('data-index') || '0')

          if (codeElement.getAttribute('data-highlighted') === 'false' && codeBlockDataArray[index]) {
            highlightCodeBlock(codeBlockDataArray[index])
            syntaxHighlightObserver.unobserve(codeElement)
          }
        }
      })
    }, {
      rootMargin: '100px' // Start highlighting 100px before entering viewport
    })

    // Observe remaining code blocks
    for (let i = immediateHighlightCount; i < codeBlockDataArray.length; i++) {
      const { element } = codeBlockDataArray[i]
      syntaxHighlightObserver.observe(element)
    }
  }
}

/**
 * Highlight a single code block
 * @param {Object} blockData - Code block data object
 */
function highlightCodeBlock (blockData) {
  const { element, lang, originalCode } = blockData

  if (element.getAttribute('data-highlighted') === 'true') {
    return // Already highlighted
  }

  try {
    let highlightedCode

    if (lang && hljs.getLanguage(lang)) {
      // Highlight the code
      highlightedCode = hljs.highlight(originalCode, {
        language: lang,
        ignoreIllegals: true
      }).value
    } else {
      // Just escape HTML if no language specified
      highlightedCode = originalCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }

    element.innerHTML = highlightedCode
    element.setAttribute('data-highlighted', 'true')

    // Add hljs class for styling
    if (lang && hljs.getLanguage(lang)) {
      element.classList.add('hljs')
      element.classList.add(`language-${lang}`)
    }
  } catch (error) {
    console.warn('Error highlighting code block:', error)
    // Fallback to escaped HTML
    element.innerHTML = originalCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    element.setAttribute('data-highlighted', 'true')
  }
}

/**
 * Cleanup syntax highlighting observer
 */
export function cleanupSyntaxHighlighting () {
  if (syntaxHighlightObserver) {
    syntaxHighlightObserver.disconnect()
    syntaxHighlightObserver = null
  }
}
