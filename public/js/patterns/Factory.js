/**
 * Factory Pattern - DOM element creation
 *
 * Centralized factory for creating DOM elements with consistent structure
 */
class DOMFactory {
  /**
   * Create a memo element
   * @param {Object} memo - Memo data
   * @param {number} index - Memo index
   * @returns {HTMLElement} Memo element
   */
  static createMemoElement (memo, index) {
    // Use createElement instead of innerHTML for better performance and XSS safety
    const memoDiv = document.createElement('div')
    memoDiv.className = 'memo-item'
    memoDiv.setAttribute('data-memo-index', index.toString())

    // Content div
    const contentDiv = document.createElement('div')
    contentDiv.className = 'memo-content'
    contentDiv.textContent = memo.content

    // Meta div
    const metaDiv = document.createElement('div')
    metaDiv.className = 'memo-meta'

    const timestampSpan = document.createElement('span')
    timestampSpan.className = 'memo-timestamp'
    timestampSpan.textContent = this.formatTimestamp(memo.timestamp)

    const actionsDiv = document.createElement('div')
    actionsDiv.className = 'memo-actions'

    const editBtn = document.createElement('button')
    editBtn.className = 'memo-edit-btn'
    editBtn.setAttribute('data-action', 'edit')
    editBtn.setAttribute('data-index', index.toString())
    editBtn.textContent = '수정'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'memo-delete-btn'
    deleteBtn.setAttribute('data-action', 'delete')
    deleteBtn.setAttribute('data-index', index.toString())
    deleteBtn.textContent = '삭제'

    actionsDiv.appendChild(editBtn)
    actionsDiv.appendChild(deleteBtn)
    metaDiv.appendChild(timestampSpan)
    metaDiv.appendChild(actionsDiv)

    // Edit form
    const editForm = document.createElement('div')
    editForm.className = 'memo-edit-form hidden'

    const textarea = document.createElement('textarea')
    textarea.placeholder = '메모를 입력하세요...'
    textarea.textContent = memo.content

    const formActions = document.createElement('div')
    formActions.className = 'form-actions'

    const saveBtn = document.createElement('button')
    saveBtn.className = 'save-btn'
    saveBtn.setAttribute('data-action', 'save')
    saveBtn.setAttribute('data-index', index.toString())
    saveBtn.textContent = '저장'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'cancel-btn'
    cancelBtn.setAttribute('data-action', 'cancel')
    cancelBtn.setAttribute('data-index', index.toString())
    cancelBtn.textContent = '취소'

    formActions.appendChild(saveBtn)
    formActions.appendChild(cancelBtn)
    editForm.appendChild(textarea)
    editForm.appendChild(formActions)

    // Assemble
    memoDiv.appendChild(contentDiv)
    memoDiv.appendChild(metaDiv)
    memoDiv.appendChild(editForm)

    return memoDiv
  }

  /**
   * Create a TOC item element
   * @param {HTMLElement} heading - Heading element
   * @param {number} level - Heading level
   * @returns {HTMLElement} TOC item element
   */
  static createTocItem (heading, level) {
    const tocItem = document.createElement('li')
    const link = document.createElement('a')
    link.href = `#${heading.id}`
    link.textContent = heading.textContent
    link.classList.add(`toc-level-${level}`)
    tocItem.appendChild(link)
    return tocItem
  }

  /**
   * Create a loading spinner element
   * @param {string} message - Loading message
   * @returns {HTMLElement} Loading spinner element
   */
  static createLoadingSpinner (message = 'Loading...') {
    const container = document.createElement('div')
    container.className = 'loading-spinner'

    const messageP = document.createElement('p')
    messageP.textContent = message

    const spinner = document.createElement('div')
    spinner.className = 'spinner'

    container.appendChild(messageP)
    container.appendChild(spinner)

    return container
  }

  /**
   * Create an error message element
   * @param {string} message - Error message
   * @returns {HTMLElement} Error element
   */
  static createErrorElement (message) {
    const errorDiv = document.createElement('p')
    errorDiv.className = 'error-message'
    errorDiv.textContent = `Error: ${message}`
    return errorDiv
  }

  /**
   * Create a selection memo button
   * @param {string} selectedText - Selected text
   * @param {number} x - X position
   * @param {number} y - Y position
   * @returns {HTMLElement} Button element
   */
  static createSelectionMemoButton (selectedText, x, y) {
    const button = document.createElement('button')
    button.className = 'selection-memo-btn selection-memo-btn-style'
    button.textContent = '메모 추가'
    button.setAttribute('data-x', x.toString())
    button.setAttribute('data-y', (y - 40).toString())
    // Set position directly via inline styles
    button.style.left = x + 'px'
    button.style.top = (y - 40) + 'px'
    return button
  }

  /**
   * Format timestamp (helper method)
   * @param {string} timestamp - ISO timestamp
   * @returns {string} Formatted timestamp
   */
  static formatTimestamp (timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    if (diff < 60000) {
      return '방금 전'
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}분 전`
    } else if (diff < 86400000) {
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
}

export default DOMFactory
