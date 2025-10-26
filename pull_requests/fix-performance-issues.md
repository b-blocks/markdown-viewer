This pull request addresses performance issues in script.js by implementing optimizations such as: 

- Batching DOM updates using DocumentFragment.
- Throttling event listeners to reduce frequent handler executions.
- Enhancing lazy loading for code block syntax highlighting.

These changes aim to reduce CPU usage and improve performance, especially on lower-end devices.