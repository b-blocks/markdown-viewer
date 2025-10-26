document.addEventListener('DOMContentLoaded', () => {
  const fileSelector = document.getElementById('fileSelector');
  document.body.style.fontSize = '70%'; // Reduce font size globally
  document.body.style.lineHeight = '1'; // Adjust line-height globally

  const fileSelectorContainer = document.getElementById('file-selector-container');
  const tocPanel = document.getElementById('toc-panel');
  const contentPanel = document.getElementById('content-panel');

  const GITHUB_API_URL = 'https://api.github.com/repos/b-blocks/StudyMaterials/contents/';
  const EXCLUDE_FOLDERS = ['.obsidian', '.git', 'scripts'];

  async function fetchFilesRecursively(url, pathPrefix = '') {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GitHub API error! status: ${response.status} for url: ${url}`);
    }
    const items = await response.json();
    let markdownFiles = [];

    for (const item of items) {
      if (item.type === 'dir') {
        if (!EXCLUDE_FOLDERS.includes(item.name)) {
          const subFiles = await fetchFilesRecursively(item.url, `${pathPrefix}${item.name}/`);
          markdownFiles = markdownFiles.concat(subFiles);
        }
      } else if (item.type === 'file' && item.name.endsWith('.md')) {
        markdownFiles.push({
          name: item.name,
          path: item.path,
          download_url: item.download_url,
        });
      }
    }
    return markdownFiles;
  }

  async function populateFileSelector() {
    fileSelectorContainer.innerHTML = '<p>Loading file list...</p>';
    try {
      const markdownFiles = await fetchFilesRecursively(GITHUB_API_URL);

      if (markdownFiles.length === 0) {
        fileSelectorContainer.innerHTML = '<p>No markdown files found in the repository.</p>';
        return;
      }

      // Clear loading message and show selector
      fileSelectorContainer.innerHTML = '';
      fileSelectorContainer.appendChild(fileSelector);

      // Sort files by path
      markdownFiles.sort((a, b) => a.path.localeCompare(b.path));

      const fragment = document.createDocumentFragment();
      markdownFiles.forEach((file) => {
        const option = document.createElement('option');
        option.value = file.download_url;
        option.textContent = file.path; // Show full path in the dropdown
        fragment.appendChild(option);
      });
      fileSelector.appendChild(fragment);

      // Add event listener and load the first file
      fileSelector.addEventListener('change', () => loadMarkdown());
      if (fileSelector.options.length > 0) {
        loadMarkdown(); // Load the initially selected file
      }
    } catch (error) {
      fileSelectorContainer.innerHTML = `<p style="color: red;">Error loading file list: ${error.message}</p>`;
    }
  }

  function throttle(func, limit) {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  let highlightObserver = null;

  function initHighlightObserver() {
    if (highlightObserver) {
      highlightObserver.disconnect();
    }

    highlightObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const codeBlock = entry.target;
            if (!codeBlock.dataset.highlighted) {
              hljs.highlightElement(codeBlock);
              codeBlock.dataset.highlighted = 'true';
              highlightObserver.unobserve(codeBlock);
            }
          }
        });
      },
      {
        rootMargin: '50px', // Start highlighting slightly before it comes into view
      }
    );
  }

  async function loadMarkdown(url) {
    if (!url && fileSelector.options.length > 0) {
      url = fileSelector.value;
    } else if (!url) {
      contentPanel.innerHTML = '<p>No file selected.</p>';
      return;
    }

    contentPanel.innerHTML = '<div class="loading-spinner"><p>Loading markdown file...</p><div class="spinner"></div></div>';
    tocPanel.innerHTML = '';

    try {
      const startTime = performance.now();

      // Fetch markdown from our server endpoint
      const response = await fetch(`/fetch-markdown?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const markdown = await response.text();

      const fetchTime = performance.now() - startTime;
      console.log(`Fetched markdown in ${fetchTime.toFixed(2)}ms (${(markdown.length / 1024).toFixed(2)} KB)`);

      contentPanel.innerHTML = '<div class="loading-spinner"><p>Rendering markdown...</p><div class="spinner"></div></div>';

      requestAnimationFrame(() => {
        const renderStart = performance.now();

        // Render markdown to HTML
        contentPanel.innerHTML = marked.parse(markdown);

        const renderTime = performance.now() - renderStart;
        console.log(`Rendered HTML in ${renderTime.toFixed(2)}ms`);

        initHighlightObserver();

        const codeBlocks = contentPanel.querySelectorAll('pre code');
        console.log(`Found ${codeBlocks.length} code blocks`);

        if (codeBlocks.length > 0) {
          const immediateHighlight = Math.min(5, codeBlocks.length);
          for (let i = 0; i < immediateHighlight; i++) {
            hljs.highlightElement(codeBlocks[i]);
            codeBlocks[i].dataset.highlighted = 'true';
          }

          for (let i = immediateHighlight; i < codeBlocks.length; i++) {
            highlightObserver.observe(codeBlocks[i]);
          }
        }

        generateToc();
        makeTablesResponsive();

        const totalTime = performance.now() - startTime;
        console.log(`Total load time: ${totalTime.toFixed(2)}ms`);
      });
    } catch (error) {
      contentPanel.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
  }

  populateFileSelector();

  window.addEventListener(
    'scroll',
    throttle(() => {
      const currentScroll = window.scrollY;
      const maxScroll = document.body.scrollHeight - window.innerHeight;

      if (currentScroll >= maxScroll - 10) {
        console.log('Reached bottom of the page');
      }
    }, 200)
  );

  function generateToc() {
    const headings = contentPanel.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
      tocPanel.innerHTML = '<p>No headings found.</p>';
      return;
    }

    const tocList = document.createElement('ul');

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.substring(1), 10);
      const text = heading.textContent;
      const slug = text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^
w-]+/g, '');
      let id = slug;

      let counter = 1;
      while (document.getElementById(id)) {
        id = `${slug}-${counter++}`;
      }
      heading.id = id;

      const tocItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${id}`;
      link.textContent = heading.textContent;
      link.classList.add(`toc-level-${level}`);

      tocItem.appendChild(link);
      tocList.appendChild(tocItem);
    });

    tocPanel.appendChild(tocList);
  }

  function makeTablesResponsive() {
    const tables = contentPanel.querySelectorAll('table');

    tables.forEach((table) => {
      const headers = table.querySelectorAll('th');
      const rows = table.querySelectorAll('tbody tr');

      rows.forEach((row) => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
          if (headers[index]) {
            cell.setAttribute('data-label', headers[index].textContent.trim());
          }
        });
      });
    });
  }
});