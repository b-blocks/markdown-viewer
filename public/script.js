document.addEventListener('DOMContentLoaded', () => {
    const fileSelector = document.getElementById('fileSelector');
    const fileSelectorContainer = document.getElementById('file-selector-container');
    const tocPanel = document.getElementById('toc-panel');
    const contentPanel = document.getElementById('content-panel');

    const GITHUB_API_URL = 'https://api.github.com/repos/b-blocks/StudyMaterials/contents/';

    async function populateFileSelector() {
        fileSelectorContainer.innerHTML = '<p>Loading file list...</p>';
        try {
            const response = await fetch(GITHUB_API_URL);
            if (!response.ok) {
                throw new Error(`GitHub API error! status: ${response.status}`);
            }
            const files = await response.json();
            const markdownFiles = files.filter(file => file.name.endsWith('.md'));

            if (markdownFiles.length === 0) {
                fileSelectorContainer.innerHTML = '<p>No markdown files found in the repository.</p>';
                return;
            }
            
            // Clear loading message and show selector
            fileSelectorContainer.innerHTML = '';
            fileSelectorContainer.appendChild(fileSelector);

            markdownFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.download_url;
                option.textContent = file.name;
                fileSelector.appendChild(option);
            });

            // Add event listener and load the first file
            fileSelector.addEventListener('change', loadMarkdown);
            loadMarkdown(); // Load the initially selected file

        } catch (error) {
            fileSelectorContainer.innerHTML = `<p style="color: red;">Error loading file list: ${error.message}</p>`;
        }
    }

    async function loadMarkdown() {
        const selectedOption = fileSelector.options[fileSelector.selectedIndex];
        const url = selectedOption.value;

        // Clear previous content
        contentPanel.innerHTML = '<p>Loading...</p>';
        tocPanel.innerHTML = '';

        try {
            // Fetch markdown from our server endpoint
            const response = await fetch(`/fetch-markdown?url=${encodeURIComponent(url)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const markdown = await response.text();

            // Render markdown to HTML
            contentPanel.innerHTML = marked.parse(markdown);

            // Apply syntax highlighting to all <pre><code> blocks
            contentPanel.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

            // Generate Table of Contents
            generateToc();

        } catch (error) {
            contentPanel.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }

    // Initialize the application
    populateFileSelector();

    function generateToc() {
        const headings = contentPanel.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) {
            tocPanel.innerHTML = '<p>No headings found.</p>';
            return;
        }
        
        const tocList = document.createElement('ul');

        headings.forEach((heading, index) => {
            const level = parseInt(heading.tagName.substring(1), 10);
            
            // Create a more robust, text-based ID (a "slug")
            const text = heading.textContent;
            const slug = text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
            let id = slug;
            
            // Ensure the ID is unique on the page
            let counter = 1;
            while (document.getElementById(id)) {
                id = `${slug}-${counter++}`;
            }
            heading.id = id;
            
            const tocItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = `#${id}`;
            link.textContent = heading.textContent;
            link.classList.add(`toc-level-${level}`); // Add class for styling

            tocItem.appendChild(link);
            tocList.appendChild(tocItem);
        });

        tocPanel.appendChild(tocList);
    }
});
