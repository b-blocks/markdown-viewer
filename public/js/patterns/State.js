/**
 * State Pattern - State management for components
 *
 * Manages state transitions and notifies observers of changes
 */
class StateMachine {
  constructor (initialState, transitions = {}) {
    this.state = initialState
    this.transitions = transitions
    this.listeners = []
    this.history = [initialState]
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getState () {
    return this.state
  }

  /**
   * Check if transition is valid
   * @param {string} toState - Target state
   * @returns {boolean} True if transition is valid
   */
  canTransition (toState) {
    if (!this.transitions[this.state]) {
      return false
    }
    return this.transitions[this.state].includes(toState)
  }

  /**
   * Transition to a new state
   * @param {string} toState - Target state
   * @param {*} data - Optional data to pass with state change
   * @returns {boolean} True if transition was successful
   */
  transition (toState, data = null) {
    if (!this.canTransition(toState)) {
      console.warn(`Invalid transition from ${this.state} to ${toState}`)
      return false
    }

    const previousState = this.state
    this.state = toState
    this.history.push(toState)

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener({
          from: previousState,
          to: toState,
          current: this.state,
          data
        })
      } catch (error) {
        console.error('Error in state listener:', error)
      }
    })

    return true
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onStateChange (callback) {
    this.listeners.push(callback)
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Reset to initial state
   */
  reset () {
    this.state = this.history[0]
    this.history = [this.state]
  }

  /**
   * Get state history
   * @returns {Array} State history
   */
  getHistory () {
    return [...this.history]
  }
}

export default StateMachine
