/**
 * File loader module for fetching and loading markdown files from GitHub
 */

const GITHUB_API_URL = 'https://api.github.com/repos/b-blocks/StudyMaterials/contents/'
const EXCLUDE_FOLDERS = ['.obsidian', '.git', 'scripts'] // 제외할 폴더 목록

/**
 * Recursively fetch markdown files from GitHub API
 * @param {string} url - GitHub API URL
 * @param {string} pathPrefix - Path prefix for nested folders
 * @returns {Promise<Array>} Array of markdown file objects
 */
export async function fetchFilesRecursively (url, pathPrefix = '') {
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
        name: item.name,
        path: item.path,
        download_url: item.download_url
      })
    }
  }
  return markdownFiles
}

/**
 * Populate file selector with markdown files from GitHub
 * @param {HTMLElement} fileSelectorContainer - Container element for file selector
 * @param {HTMLElement} fileSelector - Select element for file selection
 * @param {Function} onFileLoad - Callback function when file is selected
 */
export async function populateFileSelector (fileSelectorContainer, fileSelector, onFileLoad) {
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
    fileSelector.addEventListener('change', () => onFileLoad())
    if (fileSelector.options.length > 0) {
      onFileLoad() // Load the initially selected file
    }
  } catch (error) {
    const errorElement = document.createElement('p')
    errorElement.className = 'error-message'
    errorElement.textContent = `Error loading file list: ${error.message}`
    fileSelectorContainer.innerHTML = ''
    fileSelectorContainer.appendChild(errorElement)
  }
}

/**
 * Load markdown content from URL
 * @param {string} url - URL to fetch markdown from
 * @returns {Promise<string>} Markdown content
 */
export async function loadMarkdownContent (url) {
  const response = await fetch(`/fetch-markdown?url=${encodeURIComponent(url)}`)
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
  }
  return await response.text()
}
