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
  initSpacingControls()

  // Spacing Controls
  function initSpacingControls() {
    const lineSpacingSlider = document.getElementById('lineSpacingSlider')
    const paragraphSpacingSlider = document.getElementById('paragraphSpacingSlider')
    const lineSpacingValue = document.getElementById('lineSpacingValue')
    const paragraphSpacingValue = document.getElementById('paragraphSpacingValue')

    // Load saved values from localStorage
    const savedLineSpacing = localStorage.getItem('lineSpacing')
    const savedParagraphSpacing = localStorage.getItem('paragraphSpacing')

    if (savedLineSpacing) {
      lineSpacingSlider.value = savedLineSpacing
      lineSpacingValue.textContent = savedLineSpacing
      document.documentElement.style.setProperty('--line-height', savedLineSpacing)
    }

    if (savedParagraphSpacing) {
      paragraphSpacingSlider.value = savedParagraphSpacing
      paragraphSpacingValue.textContent = savedParagraphSpacing + 'rem'
      document.documentElement.style.setProperty('--paragraph-spacing', savedParagraphSpacing + 'rem')
    }

    // Line spacing control
    lineSpacingSlider.addEventListener('input', (e) => {
      const value = e.target.value
      lineSpacingValue.textContent = value
      document.documentElement.style.setProperty('--line-height', value)
      localStorage.setItem('lineSpacing', value)
    })

    // Paragraph spacing control
    paragraphSpacingSlider.addEventListener('input', (e) => {
      const value = e.target.value
      paragraphSpacingValue.textContent = value + 'rem'
      document.documentElement.style.setProperty('--paragraph-spacing', value + 'rem')
      localStorage.setItem('paragraphSpacing', value)
    })
  }

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
})
