document.addEventListener('DOMContentLoaded', () => {
  const fileSelector = document.getElementById('fileSelector')
  // 전체 페이지의 기본 글씨 크기를 10% 줄입니다.
  document.body.style.fontSize = '70%'
  // 전체 페이지의 기본 줄 간격을 약 10% 줄입니다. (기본값 1.5 기준)
  document.body.style.lineHeight = '1'

  const fileSelectorContainer = document.getElementById('file-selector-container')
  const tocPanel = document.getElementById('toc-panel')
  const contentPanel = document.getElementById('content-panel')

  const GITHUB_API_URL = 'https://api.github.com/repos/b-blocks/StudyMaterials/contents/'

  async function populateFileSelector () {
    fileSelectorContainer.innerHTML = '<p>Loading file list...</p>'
    try {
      const response = await fetch(GITHUB_API_URL)
      if (!response.ok) {
        throw new Error(`GitHub API error! status: ${response.status}`)
      }
      const files = await response.json()
      const markdownFiles = files.filter(file => file.name.endsWith('.md'))

      if (markdownFiles.length === 0) {
        fileSelectorContainer.innerHTML = '<p>No markdown files found in the repository.</p>'
        return
      }

      // Clear loading message and show selector
      fileSelectorContainer.innerHTML = ''
      fileSelectorContainer.appendChild(fileSelector)

      markdownFiles.forEach(file => {
        const option = document.createElement('option')
        option.value = file.download_url
        option.textContent = file.name
        fileSelector.appendChild(option)
      })

      // Add event listener and load the first file
      fileSelector.addEventListener('change', loadMarkdown)
      loadMarkdown() // Load the initially selected file
    } catch (error) {
      fileSelectorContainer.innerHTML = `<p style="color: red;">Error loading file list: ${error.message}</p>`
    }
  }

  // Intersection Observer for lazy syntax highlighting
  let highlightObserver = null

  function initHighlightObserver () {
    if (highlightObserver) {
      highlightObserver.disconnect()
    }

    highlightObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const codeBlock = entry.target
          if (!codeBlock.dataset.highlighted) {
            hljs.highlightElement(codeBlock)
            codeBlock.dataset.highlighted = 'true'
            highlightObserver.unobserve(codeBlock)
          }
        }
      })
    }, {
      rootMargin: '50px' // Start highlighting slightly before it comes into view
    })
  }

  async function loadMarkdown () {
    const selectedOption = fileSelector.options[fileSelector.selectedIndex]
    const url = selectedOption.value

    // Stop auto-scroll when loading new content
    if (typeof stopAutoScroll !== 'undefined') {
      stopAutoScroll()
    }

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

        // Render markdown to HTML (marked.js is quite fast)
        contentPanel.innerHTML = marked.parse(markdown)

        const renderTime = performance.now() - renderStart
        console.log(`Rendered HTML in ${renderTime.toFixed(2)}ms`)

        // Initialize intersection observer for lazy highlighting
        initHighlightObserver()

        // Set up lazy syntax highlighting for code blocks
        const codeBlocks = contentPanel.querySelectorAll('pre code')
        console.log(`Found ${codeBlocks.length} code blocks`)

        if (codeBlocks.length > 0) {
          // Highlight the first few visible code blocks immediately
          const immediateHighlight = Math.min(5, codeBlocks.length)
          for (let i = 0; i < immediateHighlight; i++) {
            hljs.highlightElement(codeBlocks[i])
            codeBlocks[i].dataset.highlighted = 'true'
          }

          // Set up lazy loading for the rest
          for (let i = immediateHighlight; i < codeBlocks.length; i++) {
            highlightObserver.observe(codeBlocks[i])
          }
        }

        // Generate Table of Contents
        generateToc()
        
        // Make tables responsive for mobile
        makeTablesResponsive()

        const totalTime = performance.now() - startTime
        console.log(`Total load time: ${totalTime.toFixed(2)}ms`)
      })
    } catch (error) {
      contentPanel.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`
    }
  }

  // Initialize the application
  populateFileSelector()
  initMemoSystem()


  function generateToc () {
    const headings = contentPanel.querySelectorAll('h1, h2, h3, h4, h5, h6')
    if (headings.length === 0) {
      tocPanel.innerHTML = '<p>No headings found.</p>'
      return
    }

    const tocList = document.createElement('ul')

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
      tocList.appendChild(tocItem)
    })

    tocPanel.appendChild(tocList)
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
  let autoScrollAnimationId = null
  let isAutoScrolling = false
  const autoScrollBtn = document.getElementById('autoScrollBtn')
  const scrollSpeed = 1 // pixels per frame (adjust for faster/slower scrolling)

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

    function autoScrollFrame() {
      if (!isAutoScrolling) return

      const currentScroll = getScrollTop()
      const maxScroll = getMaxScroll()

      // Stop if reached bottom
      if (currentScroll >= maxScroll - 10) {
        stopAutoScroll()
        autoScrollBtn.classList.add('at-bottom')
        return
      }

      // Use requestAnimationFrame for smoother scrolling
      setScrollTop(currentScroll + scrollSpeed)
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

  // Stop auto-scroll if user manually scrolls
  window.addEventListener('wheel', () => {
    if (isAutoScrolling) {
      stopAutoScroll()
    }
  }, { passive: true })

  // Check if at bottom and update button state
  window.addEventListener('scroll', () => {
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
  }, { passive: true })

  // Memo System
  function initMemoSystem() {
    const addMemoBtn = document.getElementById('addMemoBtn')
    const memoList = document.getElementById('memoList')
    const memoBtn = document.getElementById('memoBtn')
    
    // Load existing memos
    loadMemos()
    
    // Add memo button event listener
    addMemoBtn.addEventListener('click', () => {
      showAddMemoDialog()
    })
    
    // Floating memo button event listener
    if (memoBtn) {
      memoBtn.addEventListener('click', () => {
        window.location.href = 'memos.html'
      })
    }
    
    // Text selection for memo creation
    contentPanel.addEventListener('mouseup', handleTextSelection)
  }
  
  function loadMemos() {
    const memos = JSON.parse(localStorage.getItem('memos') || '[]')
    const memoList = document.getElementById('memoList')
    
    memoList.innerHTML = ''
    
    if (memos.length === 0) {
      memoList.innerHTML = '<p style="color: #718096; text-align: center; font-style: italic;">아직 메모가 없습니다.</p>'
      return
    }
    
    // Sort memos by creation date (newest first)
    memos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    memos.forEach((memo, index) => {
      const memoElement = createMemoElement(memo, index)
      memoList.appendChild(memoElement)
    })
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
      fileUrl: fileSelector.options[fileSelector.selectedIndex]?.value || ''
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
    
    const button = document.createElement('button')
    button.className = 'selection-memo-btn'
    button.textContent = '메모 추가'
    button.style.cssText = `
      position: absolute;
      background: #007bff;
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `
    
    button.style.left = event.pageX + 'px'
    button.style.top = (event.pageY - 40) + 'px'
    
    button.addEventListener('click', () => {
      const memoContent = `"${selectedText}"\n\n`
      const fullMemo = prompt('선택한 텍스트에 대한 메모를 추가하세요:', memoContent)
      if (fullMemo && fullMemo.trim()) {
        addMemo(fullMemo.trim())
      }
      button.remove()
    })
    
    document.body.appendChild(button)
    
    // Remove button after 3 seconds or when clicking elsewhere
    setTimeout(() => {
      if (button.parentNode) {
        button.remove()
      }
    }, 3000)
    
    document.addEventListener('click', function removeButton(e) {
      if (!button.contains(e.target)) {
        button.remove()
        document.removeEventListener('click', removeButton)
      }
    })
  }
  
  // Make functions globally available
  window.editMemo = editMemo
  window.deleteMemo = deleteMemo
  window.saveMemoEdit = saveMemoEdit
  window.cancelMemoEdit = cancelMemoEdit
})
