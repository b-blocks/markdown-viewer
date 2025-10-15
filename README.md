# Markdown Viewer

A simple web service to view markdown files from raw GitHub links with a table of contents.

## Features

1.  **Node.js Web Service**: Built with Express.js.
2.  **Fetch from GitHub**: Takes a raw GitHub content URL as input (e.g., `https://raw.githubusercontent.com/...`).
3.  **Two-Panel Layout**:
    -   **Left Panel**: A clickable table of contents generated from the markdown headings (`#`, `##`, etc.).
    -   **Right Panel**: The rendered HTML content of the markdown file.
4.  **Performance Optimized**: Optimized for large markdown files with multiple techniques:
    -   **Gzip Compression**: Server-side response compression reduces network transfer size
    -   **HTTP Caching**: Smart caching headers for faster repeated loads
    -   **Lazy Syntax Highlighting**: Code blocks are highlighted only when they enter the viewport
    -   **Progressive Rendering**: Non-blocking UI updates with requestAnimationFrame
    -   **Performance Metrics**: Console logging for load time monitoring
5.  **Auto-Scroll Feature**: Floating button in the bottom-right corner for automatic scrolling
    -   Click to start/stop auto-scrolling through the document
    -   Automatically stops when reaching the bottom or when user manually scrolls
    -   Visual feedback with color change and pulse animation while scrolling

## How to Run

1.  **Prerequisites**

    Make sure you have [pnpm](https://pnpm.io/installation) installed. You can install it with:
    ```bash
    npm install -g pnpm
    ```

2.  **Clone the repository**

    ```bash
    git clone <your-repo-url>
    cd markdown-viewer
    ```

3.  **Install dependencies**

    ```bash
    pnpm install
    ```

4.  **Run for Development**

    For development, you can run the server with `nodemon`, which will automatically restart when you save file changes.

    ```bash
    pnpm dev
    ```

5.  **Run for Production**

    To run the server normally (without auto-restarting), use the `start` command.
    ```bash
    pnpm start
    ```

6.  Open your browser and navigate to `http://localhost:3000`.

## Performance Optimizations

This viewer is optimized to handle large markdown files efficiently:

### Server-Side Optimizations

-   **Gzip Compression**: All responses are compressed using gzip (level 6), reducing network transfer size by up to 70-80% for text content
-   **HTTP Caching**: Markdown content is cached for 5 minutes (`Cache-Control: public, max-age=300`), reducing server load and improving response times for repeated requests

### Client-Side Optimizations

-   **Lazy Syntax Highlighting**: Uses `IntersectionObserver` to highlight code blocks only when they enter the viewport, significantly reducing initial rendering time for documents with many code blocks
-   **Progressive Rendering**: Uses `requestAnimationFrame` to prevent UI blocking during markdown rendering
-   **Smart Initial Highlighting**: The first 5 code blocks are highlighted immediately for better perceived performance
-   **Performance Monitoring**: Open browser console to see detailed performance metrics including:
    -   Fetch time
    -   Render time
    -   Total load time
    -   File size

### Results

For large markdown files (>500KB), these optimizations typically provide:
-   70-80% reduction in network transfer size (via gzip)
-   50-70% faster initial render time (via lazy highlighting)
-   Smooth scrolling even with 100+ code blocks
-   Better perceived performance with loading indicators

## Auto-Scroll Feature

A floating button appears in the bottom-right corner of the page that enables automatic scrolling:

-   **Play/Pause Toggle**: Click the button to start or stop auto-scrolling
-   **Visual Feedback**: 
    -   Blue icon (▶) when stopped
    -   Green icon (⏸) with pulse animation when scrolling
-   **Smart Behavior**:
    -   Automatically stops when reaching the bottom of the document
    -   Stops when user manually scrolls with mouse wheel
    -   Resets when loading a new document
-   **Smooth Scrolling**: Scrolls at 60 FPS for a smooth reading experience

## Deploy to Vercel

This project can be easily deployed with Vercel.

1.  **Fork this repository** to your GitHub account.

2.  **Go to your Vercel Dashboard** and click "Add New... > Project".

3.  **Import your forked repository** from GitHub.

4.  Vercel will automatically detect the project settings (including the use of `pnpm`). No additional configuration is needed.

5.  Click **"Deploy"**.

Once deployed, you will get a public URL for your Markdown Viewer.

[!Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fb-blocks%2Fmarkdown-viewer&project-name=markdown-viewer&repository-name=my-markdown-viewer)
