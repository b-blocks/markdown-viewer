document.addEventListener('DOMContentLoaded', () => {
  const fileSelector = document.getElementById('fileSelector')

  // Inject custom styles to handle code block wrapping
  const style = document.createElement('style')
  style.textContent = `
    pre code {
      white-space: pre-wrap !important; /* Preserve whitespace and wrap lines */
      word-break: break-all;       /* Break long words to prevent overflow */
    }
  `
  document.head.appendChild(style)

  // 전체 페이지의 기본 글씨 크기를 10% 줄입니다.
  document.body.style.fontSize = '70%'
  // 전체 페이지의 기본 줄 간격을 약 10% 줄입니다. (기본값 1.5 기준)
  document.body.style.lineHeight = '1'

  // Auto-scroll related variables, declared early to prevent TDZ issues
  let autoScrollAnimationId = null
  let isAutoScrolling = false

  // Memo system variables, declared early
  let memoEventListeners = new Map() // Track event listeners for cleanup

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
  function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout)
        func(...args)
      }
      clearTimeout(timeout)
      timeout = setTimeout(later, wait)
    }
  }

  // Throttling utility
  function throttle(func, limit) {
    let inThrottle
    return function() {
      const args = arguments
      const context = this
      if (!inThrottle) {
        func.apply(context, args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }

  // --- SCROLL HANDLERS ---
  // These are declared here because they are used by loadMarkdown

  // Unified scroll handler with debouncing
  const handleScroll = debounce(() => {
    const currentScroll = getScrollTop()
    const maxScroll = getMaxScroll()

    if (currentScroll >= maxScroll - 10) {
      if (isAutoScrolling) {
        stopAutoScroll()
      }
      autoScrollBtn.classList.add('at-bottom')
    } else {
      autoScrollBtn.classList.remove('at-bottom')
    }
  }, 16) // ~60fps

  // Stop auto-scroll if user manually scrolls with the wheel
  const handleWheelScroll = () => {
    if (isAutoScrolling) {
      stopAutoScroll()
    }
  }

  const handleUnifiedScroll = () => {
    handleScroll()
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

        // Configure marked.js to use highlight.js for syntax highlighting,
        // but only when a language is specified.
        marked.setOptions({
          highlight: function (code, lang) {
            // If a language is specified and supported by highlight.js, highlight it.
            if (lang && hljs.getLanguage(lang)) {
              return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
            }
            // Otherwise, just return the code with HTML escaped, without highlighting.
            // This prevents content truncation issues with large, un-languaged code blocks.
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

        const totalTime = performance.now() - startTime
        console.log(`Total load time: ${totalTime.toFixed(2)}ms`)

        // Re-enable scroll handling after content is fully loaded and rendered
        window.addEventListener('scroll', handleUnifiedScroll, { passive: true })

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
    
    // Clear any remaining timeouts
    if (autoScrollAnimationId) {
      cancelAnimationFrame(autoScrollAnimationId)
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
  function makeTablesResponsive() {
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

  // Auto-scroll functionality
  const autoScrollBtn = document.getElementById('autoScrollBtn')
  const scrollSpeed = 1 // pixels per frame (increased for better performance)
  const scrollThrottle = 16 // ~60fps throttling
  let lastScrollTime = 0
  let scrollAccumulator = 0

  // Cross-browser compatible scroll position getter
  function getScrollTop() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
  }

  // Cross-browser compatible scroll position setter
  function setScrollTop(position) {
    if (window.scrollTo) {
      window.scrollTo(0, position)
    } else if (document.documentElement.scrollTop !== undefined) {
      document.documentElement.scrollTop = position
    } else if (document.body.scrollTop !== undefined) {
      document.body.scrollTop = position
    }
  }

  // Cross-browser compatible scroll height getter
  function getMaxScroll() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    ) - window.innerHeight
  }

  function startAutoScroll () {
    if (isAutoScrolling) return

    isAutoScrolling = true
    autoScrollBtn.classList.add('scrolling')
    autoScrollBtn.title = 'Stop Auto Scroll'
    lastScrollTime = performance.now()
    scrollAccumulator = 0

    function autoScrollFrame() {
      if (!isAutoScrolling) return

      const now = performance.now()
      const deltaTime = now - lastScrollTime
      
      // Throttle to ~60fps
      if (deltaTime < scrollThrottle) {
        autoScrollAnimationId = requestAnimationFrame(autoScrollFrame)
        return
      }

      const currentScroll = getScrollTop()
      const maxScroll = getMaxScroll()

      // Stop if reached bottom
      if (currentScroll >= maxScroll - 10) {
        stopAutoScroll()
        autoScrollBtn.classList.add('at-bottom')
        return
      }

      // Batch scroll updates - accumulate scroll distance
      scrollAccumulator += scrollSpeed
      
      // Only update DOM when we have accumulated enough scroll
      if (scrollAccumulator >= 1) {
        const scrollAmount = Math.floor(scrollAccumulator)
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

  // Single scroll event listener
  window.addEventListener('scroll', handleUnifiedScroll, { passive: true }) // This now only handles the button state
  
  // Wheel event for immediate response
  window.addEventListener('wheel', handleWheelScroll, { passive: true })

  // Memo System

  function initMemoSystem() {
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
  function cleanupMemoSystem() {
    memoEventListeners.forEach((listener, element) => {
      element.removeEventListener(listener.event, listener.handler)
    })
    memoEventListeners.clear()
  }
  
  function loadMemos() {
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
  
  function createMemoElement(memo, index) {
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
  
  function formatTimestamp(timestamp) {
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
  
  function showAddMemoDialog() {
    const content = prompt('메모를 입력하세요:')
    if (content && content.trim()) {
      addMemo(content.trim())
    }
  }
  
  function addMemo(content) {
    const memos = JSON.parse(localStorage.getItem('memos') || '[]')
    const newMemo = {
      id: Date.now(),
      content: content,
      timestamp: new Date().toISOString(),
      fileUrl: fileSelector.value || ''
    }
    
    memos.push(newMemo)
    localStorage.setItem('memos', JSON.stringify(memos))
    loadMemos()
  }
  
  function editMemo(index) {
    const memoItems = document.querySelectorAll('.memo-item')
    const memoItem = memoItems[index]
    const editForm = memoItem.querySelector('.memo-edit-form')
    const content = memoItem.querySelector('.memo-content')
    
    content.style.display = 'none'
    editForm.style.display = 'block'
    editForm.querySelector('textarea').focus()
  }
  
  function saveMemoEdit(index) {
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
  
  function cancelMemoEdit(index) {
    const memoItems = document.querySelectorAll('.memo-item')
    const memoItem = memoItems[index]
    const editForm = memoItem.querySelector('.memo-edit-form')
    const content = memoItem.querySelector('.memo-content')
    
    editForm.style.display = 'none'
    content.style.display = 'block'
  }
  
  function deleteMemo(index) {
    if (confirm('이 메모를 삭제하시겠습니까?')) {
      const memos = JSON.parse(localStorage.getItem('memos') || '[]')
      memos.splice(index, 1)
      localStorage.setItem('memos', JSON.stringify(memos))
      loadMemos()
    }
  }
  
  function handleTextSelection(event) {
    const selection = window.getSelection()
    const selectedText = selection.toString().trim()
    
    if (selectedText.length > 0) {
      // Show a small tooltip or button near the selection
      showSelectionMemoButton(selectedText, event)
    }
  }
  
  function showSelectionMemoButton(selectedText, event) {
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
