/**
 * Strategy Pattern - Rendering strategies
 *
 * Different strategies for rendering content
 */

/**
 * Base rendering strategy
 */
class RenderingStrategy {
  render (content, target) {
    throw new Error('render() must be implemented by subclass')
  }
}

/**
 * Markdown rendering strategy
 */
export class MarkdownRenderingStrategy extends RenderingStrategy {
  constructor () {
    super()
    this.setupMarked()
  }

  setupMarked () {
    marked.setOptions({
      highlight: function (code, lang) {
        // Just escape HTML, don't highlight yet - we'll do that lazily
        return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }
    })
  }

  render (markdown, target) {
    if (typeof markdown !== 'string') {
      throw new Error('Markdown content must be a string')
    }
    target.innerHTML = marked.parse(markdown)
    return target
  }
}

/**
 * HTML rendering strategy
 */
export class HTMLRenderingStrategy extends RenderingStrategy {
  render (html, target) {
    if (typeof html !== 'string') {
      throw new Error('HTML content must be a string')
    }
    target.innerHTML = html
    return target
  }
}

/**
 * Text rendering strategy
 */
export class TextRenderingStrategy extends RenderingStrategy {
  render (text, target) {
    if (typeof text !== 'string') {
      throw new Error('Text content must be a string')
    }
    target.textContent = text
    return target
  }
}

/**
 * Renderer context that uses a strategy
 */
export class Renderer {
  constructor (strategy) {
    this.strategy = strategy
  }

  /**
   * Set rendering strategy
   * @param {RenderingStrategy} strategy - Rendering strategy
   */
  setStrategy (strategy) {
    this.strategy = strategy
  }

  /**
   * Render content using current strategy
   * @param {*} content - Content to render
   * @param {HTMLElement} target - Target element
   * @returns {HTMLElement} Rendered element
   */
  render (content, target) {
    return this.strategy.render(content, target)
  }
}
