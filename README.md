# Markdown Viewer

A simple web service to view markdown files from raw GitHub links with a table of contents.

## Features

1.  **Node.js Web Service**: Built with Express.js.
2.  **Fetch from GitHub**: Takes a raw GitHub content URL as input (e.g., `https://raw.githubusercontent.com/...`).
3.  **Two-Panel Layout**:
    -   **Left Panel**: A clickable table of contents generated from the markdown headings (`#`, `##`, etc.).
    -   **Right Panel**: The rendered HTML content of the markdown file.

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

4.  **Start the server**

    ```bash
    pnpm start
    ```

5.  Open your browser and navigate to `http://localhost:3000`.