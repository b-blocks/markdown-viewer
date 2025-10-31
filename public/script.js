document.addEventListener('DOMContentLoaded', () => {
  const fileSelector = document.getElementById('fileSelector')

  // Inject custom styles to handle code block wrapping
  const style = document.createElement('style')
  style.textContent = `
    pre code {
      white-space: pre-wrap !important; /* Preserve whitespace and wrap lines */
      word-break: break-all;       /* Break long words to prevent overflow */
      display: block;              /* Make it a block to apply max-height and overflow */
      max-height: 7.5em;           /* Limit to approximately 5 lines (assuming ~1.5em line-height) */
      overflow-y: auto;            /* Enable vertical scrolling */
    }
  `
  // Add styles to make the content panel wider on mobile (edge-to-edge)
  style.textContent += `
    @media (max-width: 768px) {
      #content-panel {
        max-width: none; /* Remove max-width limit */
        padding-left: 5px;  /* Minimize side padding */
        padding-right: 5px; /* Minimize side padding */
      }
    }
  `
  document.head.appendChild(style)

  // 전체 페이지의 기본 글씨 크기를 10% 줄입니다.
  document.body.style.fontSize = '50%'
  // 전체 페이지의 기본 줄 간격을 약 10% 줄입니다. (기본값 1.5 기준)
  document.body.style.lineHeight = '1'

  // Auto-scroll related variables, declared early to prevent TDZ issues
  let autoScrollAnimationId = null
  let isAutoScrolling = false

  // Memo system variables, declared early
  const memoEventListeners = new Map() // Track event listeners for cleanup

  // Detect mobile device for optimizations
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) ||
                   ('ontouchstart' in window)

  const fileSelectorContainer = document.getElementById('file-selector-container')
  const tocPanel = document.getElementById('toc-panel')
  const contentPanel = document.getElementById('content-panel')

  const GITHUB_API_URL = 'https://api.github.com/repos/b-blocks/StudyMaterials/contents/'
  const EXCLUDE_FOLDERS = ['.obsidian', '.git', 'scripts'] // 제외할 폴더 목록

  async function fetchFilesRecursively (url, pathPrefix = '') {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`GitHub API error! status: ${response.status} for url: ${url}`)
    }
    const items = await response.json()
    let markdownFiles = []

    for (const item of items) {
      if (item.type === 'dir') {
        if (!EXCLUDE_FOLDERS.includes(item.name)) {
          const subFiles = await fetchFilesRecursively(item.url, `${pathPrefix}${item.name}/`)
          markdownFiles = markdownFiles.concat(subFiles)
        }
      } else if (item.type === 'file' && item.name.endsWith('.md')) {
        markdownFiles.push({
          // name: `${pathPrefix}${item.name}`,
          name: item.name,
          path: item.path,
          download_url: item.download_url
        })
      }
    }
    return markdownFiles
  }

  async function populateFileSelector () {
    fileSelectorContainer.innerHTML = '<p>Loading file list...</p>'
    try {
      const markdownFiles = await fetchFilesRecursively(GITHUB_API_URL)

      if (markdownFiles.length === 0) {
        fileSelectorContainer.innerHTML = '<p>No markdown files found in the repository.</p>'
        return
      }

      // Clear loading message and show selector
      fileSelectorContainer.innerHTML = ''
      fileSelectorContainer.appendChild(fileSelector)

      // Sort files by path
      markdownFiles.sort((a, b) => a.path.localeCompare(b.path))

      markdownFiles.forEach(file => {
        const option = document.createElement('option')
        option.value = file.download_url
        option.textContent = file.path // Show full path in the dropdown
        fileSelector.appendChild(option)
      })

      // Add event listener and load the first file
      fileSelector.addEventListener('change', () => loadMarkdown())
      if (fileSelector.options.length > 0) {
        loadMarkdown() // Load the initially selected file
      }
    } catch (error) {
      fileSelectorContainer.innerHTML = `<p style="color: red;">Error loading file list: ${error.message}</p>`
    }
  }

  // Debouncing utility
  function debounce (func, wait) {
    let timeout
    return function executedFunction (...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // --- SCROLL HANDLERS ---
  // These are declared here because they are used by loadMarkdown

  // Optimized scroll handler using requestAnimationFrame for better performance
  let scrollRafId = null
  let lastScrollTop = 0
  let lastMaxScroll = 0
  let scrollListenerAdded = false

  const handleScroll = () => {
    const currentScroll = getScrollTop()

    // Only check max scroll occasionally to reduce DOM reads
    // Use cached value if available
    const maxScroll = cachedMaxScroll || getMaxScroll()

    // Only update if scroll position or max scroll changed significantly
    if (Math.abs(currentScroll - lastScrollTop) < 1 && Math.abs(maxScroll - lastMaxScroll) < 1) {
      return
    }

    lastScrollTop = currentScroll
    lastMaxScroll = maxScroll

    if (currentScroll >= maxScroll - 10) {
      if (isAutoScrolling) {
        stopAutoScroll()
      }
      autoScrollBtn.classList.add('at-bottom')
    } else {
      autoScrollBtn.classList.remove('at-bottom')
    }
  }

  // Stop auto-scroll if user manually scrolls with the wheel
  const handleWheelScroll = () => {
    if (isAutoScrolling) {
      stopAutoScroll()
    }
  }

  const handleUnifiedScroll = () => {
    // Use requestAnimationFrame to throttle scroll events
    if (scrollRafId === null) {
      scrollRafId = requestAnimationFrame(() => {
        handleScroll()
        scrollRafId = null
      })
    }
  }

  async function loadMarkdown (url) {
    if (!url && fileSelector.options.length > 0) {
      url = fileSelector.value
    } else if (!url) {
      contentPanel.innerHTML = '<p>No file selected.</p>'
      return
    }

    // Temporarily disable scroll handling to prevent race conditions during content replacement
    window.removeEventListener('scroll', handleUnifiedScroll)

    // Stop auto-scroll when loading new content
    stopAutoScroll()

    // Clear previous content
    contentPanel.innerHTML = '<div class="loading-spinner"><p>Loading markdown file...</p><div class="spinner"></div></div>'
    tocPanel.innerHTML = ''

    try {
      const startTime = performance.now()

      // Fetch markdown from our server endpoint
      const response = await fetch(`/fetch-markdown?url=${encodeURIComponent(url)}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }
      const markdown = await response.text()

      const fetchTime = performance.now() - startTime
      console.log(`Fetched markdown in ${fetchTime.toFixed(2)}ms (${(markdown.length / 1024).toFixed(2)} KB)`)

      // Show rendering progress
      contentPanel.innerHTML = '<div class="loading-spinner"><p>Rendering markdown...</p><div class="spinner"></div></div>'

      // Use requestAnimationFrame to prevent blocking the UI
      requestAnimationFrame(() => {
        const renderStart = performance.now()

        // Configure marked.js to skip syntax highlighting initially (lazy loading)
        // We'll highlight code blocks only when they enter the viewport
        marked.setOptions({
          highlight: function (code, lang) {
            // Just escape HTML, don't highlight yet - we'll do that lazily
            return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          }
        })

        // Render markdown to HTML (marked.js is quite fast)
        contentPanel.innerHTML = marked.parse(markdown)

        const renderTime = performance.now() - renderStart
        console.log(`Rendered HTML in ${renderTime.toFixed(2)}ms`)

        // Generate Table of Contents
        generateToc()

        // Make tables responsive for mobile
        makeTablesResponsive()

        // Initialize lazy syntax highlighting
        initLazySyntaxHighlighting()

        // Invalidate scroll cache when new content is loaded
        invalidateMaxScrollCache()

        const totalTime = performance.now() - startTime
        console.log(`Total load time: ${totalTime.toFixed(2)}ms`)

        // Re-enable scroll handling after content is fully loaded
        // Only add listener if not already added to avoid duplicates
        if (!scrollListenerAdded) {
          window.addEventListener('scroll', handleUnifiedScroll, { passive: true })
          scrollListenerAdded = true
        }

        // Explicitly reset scroll position and update button state to avoid race conditions
        requestAnimationFrame(() => {
          window.scrollTo(0, 0)
          handleScroll()
        })
      })
    } catch (error) {
      contentPanel.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`
    }
  }

  // Initialize the application
  populateFileSelector()
  initMemoSystem()

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    cleanupMemoSystem()

    // Clean up syntax highlighting observer
    if (syntaxHighlightObserver) {
      syntaxHighlightObserver.disconnect()
      syntaxHighlightObserver = null
    }

    // Clear any remaining animation frames
    if (autoScrollAnimationId) {
      cancelAnimationFrame(autoScrollAnimationId)
    }
    if (scrollRafId) {
      cancelAnimationFrame(scrollRafId)
    }
  })

  function generateToc () {
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
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1), 10)

      // Create a more robust, text-based ID (a "slug")
      const text = heading.textContent
      const slug = text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
      let id = slug

      // Ensure the ID is unique on the page
      let counter = 1
      while (document.getElementById(id)) {
        id = `${slug}-${counter++}`
      }
      heading.id = id

      const tocItem = document.createElement('li')
      const link = document.createElement('a')
      link.href = `#${id}`
      link.textContent = heading.textContent
      link.classList.add(`toc-level-${level}`) // Add class for styling

      tocItem.appendChild(link)
      tocItems.push(tocItem)
    })

    // Batch append all items at once
    tocItems.forEach(item => tocList.appendChild(item))
    fragment.appendChild(tocList)

    // Single DOM update
    tocPanel.innerHTML = ''
    tocPanel.appendChild(fragment)
  }

  // Make tables responsive for mobile
  function makeTablesResponsive () {
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

  // Lazy syntax highlighting using IntersectionObserver
  let syntaxHighlightObserver = null
  let codeBlockDataArray = [] // Store code block data for lazy highlighting

  function initLazySyntaxHighlighting () {
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
        // Reduce rootMargin on mobile to save CPU (smaller viewport = less pre-loading needed)
        rootMargin: isMobile ? '50px' : '100px'
      })

      // Observe remaining code blocks
      for (let i = immediateHighlightCount; i < codeBlockDataArray.length; i++) {
        const { element } = codeBlockDataArray[i]
        syntaxHighlightObserver.observe(element)
      }
    }
  }

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

  // Auto-scroll functionality
  const autoScrollBtn = document.getElementById('autoScrollBtn')
  const scrollSpeed = 1 // pixels per frame
  const scrollThrottle = 16 // ~60fps throttling
  let lastScrollTime = 0
  let scrollAccumulator = 0

  // Cache for max scroll to avoid expensive DOM reads
  let cachedMaxScroll = 0
  let maxScrollCacheTime = 0
  const maxScrollCacheTTL = 100 // Cache for 100ms to reduce DOM reads

  // Cross-browser compatible scroll position getter (optimized)
  function getScrollTop () {
    // Use the most performant method for modern browsers
    return window.pageYOffset || document.documentElement.scrollTop || 0
  }

  // Optimized scroll position setter
  function setScrollTop (position) {
    // Use scrollTo for consistent behavior across all documents
    window.scrollTo({
      top: position,
      left: 0,
      behavior: 'auto'
    })
  }

  // Optimized scroll height getter with caching
  function getMaxScroll () {
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

  // Invalidate max scroll cache (call when content changes)
  function invalidateMaxScrollCache () {
    cachedMaxScroll = 0
    maxScrollCacheTime = 0
  }

  function startAutoScroll () {
    if (isAutoScrolling) return

    isAutoScrolling = true
    autoScrollBtn.classList.add('scrolling')
    autoScrollBtn.title = 'Stop Auto Scroll'
    lastScrollTime = performance.now()
    scrollAccumulator = 0

    // Counter to periodically check max scroll (not every frame)
    let maxScrollCheckCounter = 0
    const maxScrollCheckInterval = 5 // Check every 5 frames

    function autoScrollFrame () {
      if (!isAutoScrolling) return

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
      let maxScroll = cachedMaxScroll
      if (maxScrollCheckCounter >= maxScrollCheckInterval || cachedMaxScroll === 0) {
        maxScroll = getMaxScroll()
        maxScrollCheckCounter = 0
      }

      // Stop if reached bottom
      const bottomThreshold = 10
      if (currentScroll >= maxScroll - bottomThreshold) {
        stopAutoScroll()
        autoScrollBtn.classList.add('at-bottom')
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

  function stopAutoScroll () {
    if (!isAutoScrolling) return

    isAutoScrolling = false
    autoScrollBtn.classList.remove('scrolling')
    autoScrollBtn.title = 'Auto Scroll'

    if (autoScrollAnimationId) {
      cancelAnimationFrame(autoScrollAnimationId)
      autoScrollAnimationId = null
    }
  }

  function toggleAutoScroll () {
    if (isAutoScrolling) {
      stopAutoScroll()
    } else {
      autoScrollBtn.classList.remove('at-bottom')
      startAutoScroll()
    }
  }

  // Event listeners for auto-scroll button
  autoScrollBtn.addEventListener('click', toggleAutoScroll)

  // Single scroll event listener (only add if not already added)
  if (!scrollListenerAdded) {
    window.addEventListener('scroll', handleUnifiedScroll, { passive: true })
    scrollListenerAdded = true
  }

  // Wheel event for immediate response (only on desktop - mobile doesn't have wheel events)
  if (!isMobile) {
    window.addEventListener('wheel', handleWheelScroll, { passive: true })
  }

  // Memo System

  function initMemoSystem () {
    const memoBtn = document.getElementById('memoBtn')
    const contentPanel = document.getElementById('content-panel')

    // Floating memo button event listener
    if (memoBtn) {
      const memoBtnHandler = () => {
        window.location.href = 'memos.html'
      }
      memoBtn.addEventListener('click', memoBtnHandler)
      memoEventListeners.set(memoBtn, { event: 'click', handler: memoBtnHandler })
    }

    // Text selection for memo creation
    const textSelectionHandler = handleTextSelection
    contentPanel.addEventListener('mouseup', textSelectionHandler)
    memoEventListeners.set(contentPanel, { event: 'mouseup', handler: textSelectionHandler })
  }

  // Cleanup function for memo system
  function cleanupMemoSystem () {
    memoEventListeners.forEach((listener, element) => {
      element.removeEventListener(listener.event, listener.handler)
    })
    memoEventListeners.clear()
  }

  function loadMemos () {
    const memos = JSON.parse(localStorage.getItem('memos') || '[]')
    const memoList = document.getElementById('memoList')

    if (memos.length === 0) {
      memoList.innerHTML = '<p style="color: #718096; text-align: center; font-style: italic;">아직 메모가 없습니다.</p>'
      return
    }

    // Sort memos by creation date (newest first)
    memos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    // Use DocumentFragment for batch DOM operations
    const fragment = document.createDocumentFragment()

    memos.forEach((memo, index) => {
      const memoElement = createMemoElement(memo, index)
      fragment.appendChild(memoElement)
    })

    // Single DOM update
    memoList.innerHTML = ''
    memoList.appendChild(fragment)
  }

  function createMemoElement (memo, index) {
    const memoDiv = document.createElement('div')
    memoDiv.className = 'memo-item'
    memoDiv.innerHTML = `
      <div class="memo-content">${memo.content}</div>
      <div class="memo-meta">
        <span class="memo-timestamp">${formatTimestamp(memo.timestamp)}</span>
        <div class="memo-actions">
          <button class="memo-edit-btn" onclick="editMemo(${index})">수정</button>
          <button class="memo-delete-btn" onclick="deleteMemo(${index})">삭제</button>
        </div>
      </div>
      <div class="memo-edit-form" style="display: none;">
        <textarea placeholder="메모를 입력하세요...">${memo.content}</textarea>
        <div class="form-actions">
          <button class="save-btn" onclick="saveMemoEdit(${index})">저장</button>
          <button class="cancel-btn" onclick="cancelMemoEdit(${index})">취소</button>
        </div>
      </div>
    `
    return memoDiv
  }

  function formatTimestamp (timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) { // Less than 1 minute
      return '방금 전'
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}분 전`
    } else if (diff < 86400000) { // Less than 1 day
      return `${Math.floor(diff / 3600000)}시간 전`
    } else {
      return date.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  function addMemo (content) {
    const memos = JSON.parse(localStorage.getItem('memos') || '[]')
    const newMemo = {
      id: Date.now(),
      content,
      timestamp: new Date().toISOString(),
      fileUrl: fileSelector.value || ''
    }

    memos.push(newMemo)
    localStorage.setItem('memos', JSON.stringify(memos))
    loadMemos()
  }

  function editMemo (index) {
    const memoItems = document.querySelectorAll('.memo-item')
    const memoItem = memoItems[index]
    const editForm = memoItem.querySelector('.memo-edit-form')
    const content = memoItem.querySelector('.memo-content')

    content.style.display = 'none'
    editForm.style.display = 'block'
    editForm.querySelector('textarea').focus()
  }

  function saveMemoEdit (index) {
    const memos = JSON.parse(localStorage.getItem('memos') || '[]')
    const memoItems = document.querySelectorAll('.memo-item')
    const memoItem = memoItems[index]
    const editForm = memoItem.querySelector('.memo-edit-form')
    const newContent = editForm.querySelector('textarea').value.trim()

    if (newContent) {
      memos[index].content = newContent
      memos[index].timestamp = new Date().toISOString()
      localStorage.setItem('memos', JSON.stringify(memos))
      loadMemos()
    } else {
      alert('메모 내용을 입력해주세요.')
    }
  }

  function cancelMemoEdit (index) {
    const memoItems = document.querySelectorAll('.memo-item')
    const memoItem = memoItems[index]
    const editForm = memoItem.querySelector('.memo-edit-form')
    const content = memoItem.querySelector('.memo-content')

    editForm.style.display = 'none'
    content.style.display = 'block'
  }

  function deleteMemo (index) {
    if (confirm('이 메모를 삭제하시겠습니까?')) {
      const memos = JSON.parse(localStorage.getItem('memos') || '[]')
      memos.splice(index, 1)
      localStorage.setItem('memos', JSON.stringify(memos))
      loadMemos()
    }
  }

  // Throttle text selection handler to avoid excessive CPU usage
  let lastSelectionTime = 0
  const selectionThrottle = 200 // ms

  function handleTextSelection (event) {
    const now = Date.now()
    if (now - lastSelectionTime < selectionThrottle) {
      return // Skip if called too frequently
    }
    lastSelectionTime = now

    const selection = window.getSelection()
    const selectedText = selection.toString().trim()

    if (selectedText.length > 0) {
      // Use requestAnimationFrame to defer non-critical work
      requestAnimationFrame(() => {
        showSelectionMemoButton(selectedText, event)
      })
    }
  }

  function showSelectionMemoButton (selectedText, event) {
    // Remove existing memo button if any
    const existingBtn = document.querySelector('.selection-memo-btn')
    if (existingBtn) {
      existingBtn.remove()
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment()
    const button = document.createElement('button')
    button.className = 'selection-memo-btn'
    button.textContent = '메모 추가'

    // Use CSS classes instead of inline styles for better performance
    button.classList.add('selection-memo-btn-style')
    button.style.left = event.pageX + 'px'
    button.style.top = (event.pageY - 40) + 'px'

    // Debounced click handler
    const debouncedClickHandler = debounce(() => {
      const memoContent = `"${selectedText}"\n\n`
      const fullMemo = prompt('선택한 텍스트에 대한 메모를 추가하세요:', memoContent)
      if (fullMemo && fullMemo.trim()) {
        addMemo(fullMemo.trim())
      }
      button.remove()
    }, 100)

    button.addEventListener('click', debouncedClickHandler)

    fragment.appendChild(button)
    document.body.appendChild(fragment)

    // Remove button after 3 seconds or when clicking elsewhere
    const removeTimeout = setTimeout(() => {
      if (button.parentNode) {
        button.remove()
      }
    }, 3000)

    const removeButtonHandler = (e) => {
      if (!button.contains(e.target)) {
        button.remove()
        clearTimeout(removeTimeout)
        document.removeEventListener('click', removeButtonHandler)
      }
    }

    document.addEventListener('click', removeButtonHandler)
  }

  // Make functions globally available
  window.editMemo = editMemo
  window.deleteMemo = deleteMemo
  window.saveMemoEdit = saveMemoEdit
  window.cancelMemoEdit = cancelMemoEdit
})
