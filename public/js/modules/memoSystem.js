/**
 * Memo system module with Factory and Command patterns
 */

import { debounce } from '../utils/debounce.js'
import DOMFactory from '../patterns/Factory.js'
import { AddMemoCommand, DeleteMemoCommand, EditMemoCommand, CommandInvoker } from '../patterns/Command.js'
import { eventBus } from '../patterns/Observer.js'

// Command invoker instance
const commandInvoker = new CommandInvoker()

const memoEventListeners = new Map() // Track event listeners for cleanup
let lastSelectionTime = 0
const selectionThrottle = 200 // ms

// Cache for localStorage data to avoid repeated parsing
let memosCache = null
let memosCacheTimestamp = 0
const CACHE_TTL = 100 // ms

/**
 * Initialize memo system
 * @param {HTMLElement} memoBtn - Memo button element
 * @param {HTMLElement} contentPanel - Content panel element
 * @param {Function} addMemoCallback - Callback function to add memo
 * @param {HTMLElement} memoList - Memo list container element (optional)
 */
export function initMemoSystem (memoBtn, contentPanel, addMemoCallback, memoList = null) {
  // Floating memo button event listener
  if (memoBtn) {
    const memoBtnHandler = () => {
      window.location.href = 'memos.html'
    }
    memoBtn.addEventListener('click', memoBtnHandler)
    memoEventListeners.set(memoBtn, { event: 'click', handler: memoBtnHandler })
  }

  // Text selection for memo creation
  if (addMemoCallback && contentPanel) {
    const textSelectionHandler = createTextSelectionHandler(addMemoCallback)
    contentPanel.addEventListener('mouseup', textSelectionHandler)
    memoEventListeners.set(contentPanel, { event: 'mouseup', handler: textSelectionHandler })
  }

  // Set up event delegation for memo buttons if memoList exists
  if (memoList) {
    setupMemoEventDelegation(memoList)
  }
}

/**
 * Set up event delegation for memo buttons
 * @param {HTMLElement} memoList - Memo list container element
 */
function setupMemoEventDelegation (memoList) {
  const handler = (event) => {
    const button = event.target.closest('[data-action]')
    if (!button) return

    const action = button.getAttribute('data-action')
    const index = parseInt(button.getAttribute('data-index'), 10)

    if (isNaN(index)) return

    switch (action) {
      case 'edit':
        editMemo(index, memoList)
        break
      case 'delete':
        deleteMemo(index, memoList)
        break
      case 'save':
        saveMemoEdit(index, memoList)
        break
      case 'cancel':
        cancelMemoEdit(index, memoList)
        break
    }
  }

  memoList.addEventListener('click', handler)
  memoEventListeners.set(memoList, { event: 'click', handler })
}

/**
 * Cleanup function for memo system
 */
export function cleanupMemoSystem () {
  memoEventListeners.forEach((listener, element) => {
    element.removeEventListener(listener.event, listener.handler)
  })
  memoEventListeners.clear()
}

/**
 * Get memos from localStorage with caching
 * @returns {Array} Array of memos
 */
function getMemos () {
  const now = Date.now()
  if (memosCache && (now - memosCacheTimestamp) < CACHE_TTL) {
    return memosCache
  }

  try {
    memosCache = JSON.parse(localStorage.getItem('memos') || '[]')
    memosCacheTimestamp = now
    return memosCache
  } catch (error) {
    console.error('Error reading memos from localStorage:', error)
    return []
  }
}

/**
 * Invalidate memos cache
 */
function invalidateMemosCache () {
  memosCache = null
  memosCacheTimestamp = 0
}

/**
 * Load memos from localStorage and display them
 * @param {HTMLElement} memoList - Memo list container element
 */
export function loadMemos (memoList) {
  if (!memoList) return

  const memos = getMemos()

  if (memos.length === 0) {
    const emptyMessage = document.createElement('p')
    emptyMessage.className = 'memo-empty-message'
    emptyMessage.textContent = '아직 메모가 없습니다.'
    memoList.innerHTML = ''
    memoList.appendChild(emptyMessage)
    return
  }

  // Sort memos by creation date (newest first)
  memos.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  // Use DocumentFragment for batch DOM operations
  const fragment = document.createDocumentFragment()

  memos.forEach((memo, index) => {
    const memoElement = DOMFactory.createMemoElement(memo, index)
    fragment.appendChild(memoElement)
  })

  // Single DOM update
  memoList.innerHTML = ''
  memoList.appendChild(fragment)
}

/**
 * Show add memo dialog
 * @param {Function} addMemoCallback - Callback to add memo
 */
export function showAddMemoDialog (addMemoCallback) {
  const content = prompt('메모를 입력하세요:')
  if (content && content.trim()) {
    addMemoCallback(content.trim())
  }
}

/**
 * Add memo to localStorage using Command Pattern
 * @param {string} content - Memo content
 * @param {string} fileUrl - Current file URL
 * @param {HTMLElement} memoList - Memo list container element
 */
export function addMemo (content, fileUrl, memoList) {
  if (!memoList) return

  const newMemo = {
    id: Date.now(),
    content,
    timestamp: new Date().toISOString(),
    fileUrl: fileUrl || ''
  }

  try {
    const command = new AddMemoCommand(newMemo, localStorage, memoList)
    commandInvoker.execute(command)

    invalidateMemosCache() // Clear cache after modification
    eventBus.emit('memo:added', { memo: newMemo })
    loadMemos(memoList)
  } catch (error) {
    console.error('Error adding memo:', error)
    alert(error.message || '메모 추가 중 오류가 발생했습니다.')
  }
}

/**
 * Edit memo
 * @param {number} index - Memo index
 * @param {HTMLElement} memoList - Memo list container element (optional, for optimization)
 */
export function editMemo (index, memoList = null) {
  // Use memoList if provided, otherwise fallback to querySelector
  const memoItem = memoList
    ? memoList.querySelector(`[data-memo-index="${index}"]`)
    : document.querySelector(`[data-memo-index="${index}"]`)

  if (!memoItem) return

  const editForm = memoItem.querySelector('.memo-edit-form')
  const content = memoItem.querySelector('.memo-content')

  if (!editForm || !content) return

  const textarea = editForm.querySelector('textarea')
  if (!textarea) return

  content.classList.add('hidden')
  editForm.classList.remove('hidden')
  textarea.focus()
}

/**
 * Save memo edit using Command Pattern
 * @param {number} index - Memo index
 * @param {HTMLElement} memoList - Memo list container element
 */
export function saveMemoEdit (index, memoList) {
  if (!memoList) return

  // Use event delegation - find memo item by data attribute instead of querySelectorAll
  const memoItem = memoList.querySelector(`[data-memo-index="${index}"]`)
  if (!memoItem) return

  const editForm = memoItem.querySelector('.memo-edit-form')
  if (!editForm) return

  const textarea = editForm.querySelector('textarea')
  if (!textarea) return

  const newContent = textarea.value.trim()

  if (newContent) {
    try {
      const command = new EditMemoCommand(index, newContent, localStorage)
      commandInvoker.execute(command)

      invalidateMemosCache() // Clear cache after modification
      eventBus.emit('memo:edited', { index, content: newContent })
      loadMemos(memoList)
    } catch (error) {
      console.error('Error editing memo:', error)
      alert(error.message || '메모 수정 중 오류가 발생했습니다.')
    }
  } else {
    alert('메모 내용을 입력해주세요.')
  }
}

/**
 * Cancel memo edit
 * @param {number} index - Memo index
 * @param {HTMLElement} memoList - Memo list container element (optional, for optimization)
 */
export function cancelMemoEdit (index, memoList = null) {
  const memoItem = memoList
    ? memoList.querySelector(`[data-memo-index="${index}"]`)
    : document.querySelector(`[data-memo-index="${index}"]`)

  if (!memoItem) return

  const editForm = memoItem.querySelector('.memo-edit-form')
  const content = memoItem.querySelector('.memo-content')

  if (!editForm || !content) return

  editForm.classList.add('hidden')
  content.classList.remove('hidden')
}

/**
 * Delete memo using Command Pattern
 * @param {number} index - Memo index
 * @param {HTMLElement} memoList - Memo list container element
 */
export function deleteMemo (index, memoList) {
  if (!memoList) return

  if (confirm('이 메모를 삭제하시겠습니까?')) {
    try {
      const command = new DeleteMemoCommand(index, localStorage)
      commandInvoker.execute(command)

      invalidateMemosCache() // Clear cache after modification
      eventBus.emit('memo:deleted', { index })
      loadMemos(memoList)
    } catch (error) {
      console.error('Error deleting memo:', error)
      alert(error.message || '메모 삭제 중 오류가 발생했습니다.')
    }
  }
}

/**
 * Handle text selection for memo creation
 * @param {Event} event - Mouse event
 * @param {Function} addMemoCallback - Callback to add memo
 */
function handleTextSelection (event, addMemoCallback) {
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
      showSelectionMemoButton(selectedText, event, addMemoCallback)
    })
  }
}

// Cache for selection button to avoid repeated queries
let currentSelectionButton = null
let removeButtonTimeout = null
let removeButtonHandler = null

/**
 * Cleanup selection button resources
 */
function cleanupSelectionButton () {
  if (currentSelectionButton && currentSelectionButton.parentNode) {
    currentSelectionButton.remove()
  }
  if (removeButtonTimeout) {
    clearTimeout(removeButtonTimeout)
    removeButtonTimeout = null
  }
  if (removeButtonHandler) {
    document.removeEventListener('click', removeButtonHandler)
    removeButtonHandler = null
  }
  currentSelectionButton = null
}

/**
 * Show selection memo button
 * @param {string} selectedText - Selected text
 * @param {Event} event - Mouse event
 * @param {Function} addMemoCallback - Callback to add memo
 */
function showSelectionMemoButton (selectedText, event, addMemoCallback) {
  // Remove existing memo button if any
  cleanupSelectionButton()

  // Use Factory Pattern to create button
  const x = event.pageX || 0
  const y = event.pageY || 0
  const button = DOMFactory.createSelectionMemoButton(selectedText, x, y)
  currentSelectionButton = button

  // Debounced click handler
  const debouncedClickHandler = debounce(() => {
    const memoContent = `"${selectedText}"\n\n`
    const fullMemo = prompt('선택한 텍스트에 대한 메모를 추가하세요:', memoContent)
    if (fullMemo && fullMemo.trim()) {
      addMemoCallback(fullMemo.trim())
    }
    cleanupSelectionButton()
  }, 100)

  button.addEventListener('click', debouncedClickHandler)

  document.body.appendChild(button)

  // Remove button after 3 seconds or when clicking elsewhere
  removeButtonTimeout = setTimeout(() => {
    cleanupSelectionButton()
  }, 3000)

  removeButtonHandler = (e) => {
    if (!button.contains(e.target)) {
      cleanupSelectionButton()
    }
  }

  document.addEventListener('click', removeButtonHandler, { once: true })
}

// Export wrapper function that includes addMemoCallback
export function createTextSelectionHandler (addMemoCallback) {
  return (event) => handleTextSelection(event, addMemoCallback)
}
