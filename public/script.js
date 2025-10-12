document.addEventListener('DOMContentLoaded', () => {
    const viewButton = document.getElementById('viewButton');
    const markdownUrlInput = document.getElementById('markdownUrl');
    const tocPanel = document.getElementById('toc-panel');
    const contentPanel = document.getElementById('content-panel');

    viewButton.addEventListener('click', loadMarkdown);
    // Allow pressing Enter in the input field to trigger the view
    markdownUrlInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            loadMarkdown();
        }
    });

    // Load the default markdown on page load
    if (markdownUrlInput.value) {
        loadMarkdown();
    }

    async function loadMarkdown() {
        const url = markdownUrlInput.value.trim();
        if (!url) {
            // Use a less disruptive notification
            contentPanel.innerHTML = `<p style="color: orange;">Please enter a URL.</p>`;
            return;
        }

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
