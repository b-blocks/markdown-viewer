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

## Deploy to Vercel

This project can be easily deployed with Vercel.

1.  **Fork this repository** to your GitHub account.

2.  **Go to your Vercel Dashboard** and click "Add New... > Project".

3.  **Import your forked repository** from GitHub.

4.  Vercel will automatically detect the project settings (including the use of `pnpm`). No additional configuration is needed.

5.  Click **"Deploy"**.

Once deployed, you will get a public URL for your Markdown Viewer.

[!Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fb-blocks%2Fmarkdown-viewer&project-name=markdown-viewer&repository-name=my-markdown-viewer)