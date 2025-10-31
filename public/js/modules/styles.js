/**
 * Initialize custom styles for the application
 */
export function initStyles () {
  // Inject custom styles to handle code block wrapping
  const style = document.createElement('style')
  style.textContent = `
    pre code {
      white-space: pre-wrap !important; /* Preserve whitespace and wrap lines */
      word-break: break-all;       /* Break long words to prevent overflow */
      display: block;              /* Make it a block to apply max-height and overflow */
      max-height: 7.5em;           /* Limit to approximately 5 lines (assuming ~1.5em line-height) */
      overflow-y: auto;            /* Enable vertical scrolling */
    }
    
    /* Large file progress indicator */
    .large-file-progress {
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      min-width: 200px;
    }
    
    .progress-bar-container {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff6b35, #e55a2b);
      border-radius: 3px;
      transition: width 0.2s ease;
      width: 0%;
    }
    
    .progress-text {
      font-size: 12px;
      text-align: center;
      color: rgba(255, 255, 255, 0.9);
    }
    
    .progress-percent {
      font-weight: bold;
      color: #ff6b35;
    }
    
    .progress-fade-out {
      opacity: 0;
      transition: opacity 0.3s ease;
    }
  `
  // Add styles to make the content panel wider on mobile (edge-to-edge)
  style.textContent += `
    @media (max-width: 768px) {
      #content-panel {
        max-width: none; /* Remove max-width limit */
        padding-left: 5px;  /* Minimize side padding */
        padding-right: 5px; /* Minimize side padding */
      }
      
      .large-file-progress {
        top: 10px;
        right: 10px;
        left: 10px;
        min-width: auto;
      }
    }
  `
  document.head.appendChild(style)
}
