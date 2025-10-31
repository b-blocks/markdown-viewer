/**
 * Command Pattern - Action abstraction
 *
 * Encapsulates actions as objects, allowing for undo/redo and command queuing
 */

/**
 * Base command interface
 */
export class Command {
  constructor (execute, undo = null) {
    this.execute = execute
    this.undo = undo
    this.executed = false
  }

  /**
   * Execute the command
   * @param {*} args - Arguments for execution
   * @returns {*} Result of execution
   */
  executeCommand (...args) {
    const result = this.execute(...args)
    this.executed = true
    return result
  }

  /**
   * Undo the command
   * @param {*} args - Arguments for undo
   * @returns {*} Result of undo
   */
  undoCommand (...args) {
    if (!this.executed) {
      console.warn('Cannot undo command that has not been executed')
      return null
    }
    if (this.undo) {
      const result = this.undo(...args)
      this.executed = false
      return result
    }
    return null
  }
}

/**
 * Command for adding a memo
 */
export class AddMemoCommand extends Command {
  constructor (memo, storage, displayList) {
    const execute = () => {
      try {
        const memos = JSON.parse(storage.getItem('memos') || '[]')
        memos.push(memo)
        storage.setItem('memos', JSON.stringify(memos))
        this.savedMemos = memos
        return memo
      } catch (error) {
        console.error('Error adding memo:', error)
        throw new Error('메모 추가 중 오류가 발생했습니다.')
      }
    }

    const undo = () => {
      const memos = JSON.parse(storage.getItem('memos') || '[]')
      const index = memos.findIndex(m => m.id === memo.id)
      if (index > -1) {
        memos.splice(index, 1)
        storage.setItem('memos', JSON.stringify(memos))
        return true
      }
      return false
    }

    super(execute, undo)
    this.memo = memo
    this.storage = storage
    this.displayList = displayList
  }
}

/**
 * Command for deleting a memo
 */
export class DeleteMemoCommand extends Command {
  constructor (index, storage) {
    const execute = () => {
      try {
        const memos = JSON.parse(storage.getItem('memos') || '[]')
        this.deletedMemo = memos[index]
        this.deletedIndex = index
        memos.splice(index, 1)
        storage.setItem('memos', JSON.stringify(memos))
        return this.deletedMemo
      } catch (error) {
        console.error('Error deleting memo:', error)
        throw new Error('메모 삭제 중 오류가 발생했습니다.')
      }
    }

    const undo = () => {
      if (this.deletedMemo && this.deletedIndex !== undefined) {
        const memos = JSON.parse(storage.getItem('memos') || '[]')
        memos.splice(this.deletedIndex, 0, this.deletedMemo)
        storage.setItem('memos', JSON.stringify(memos))
        return true
      }
      return false
    }

    super(execute, undo)
    this.index = index
    this.storage = storage
  }
}

/**
 * Command for editing a memo
 */
export class EditMemoCommand extends Command {
  constructor (index, newContent, storage) {
    const execute = () => {
      try {
        const memos = JSON.parse(storage.getItem('memos') || '[]')
        this.oldContent = memos[index].content
        this.oldTimestamp = memos[index].timestamp
        memos[index].content = newContent
        memos[index].timestamp = new Date().toISOString()
        storage.setItem('memos', JSON.stringify(memos))
        return memos[index]
      } catch (error) {
        console.error('Error editing memo:', error)
        throw new Error('메모 수정 중 오류가 발생했습니다.')
      }
    }

    const undo = () => {
      if (this.oldContent !== undefined) {
        const memos = JSON.parse(storage.getItem('memos') || '[]')
        memos[this.index].content = this.oldContent
        memos[this.index].timestamp = this.oldTimestamp
        storage.setItem('memos', JSON.stringify(memos))
        return true
      }
      return false
    }

    super(execute, undo)
    this.index = index
    this.storage = storage
  }
}

/**
 * Command invoker - manages command execution and history
 */
export class CommandInvoker {
  constructor () {
    this.history = []
    this.maxHistorySize = 50
  }

  /**
   * Execute a command
   * @param {Command} command - Command to execute
   * @param {*} args - Arguments for command
   * @returns {*} Result of command execution
   */
  execute (command, ...args) {
    const result = command.executeCommand(...args)
    this.history.push(command)

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }

    return result
  }

  /**
   * Undo last command
   * @returns {boolean} True if undo was successful
   */
  undo () {
    if (this.history.length === 0) {
      return false
    }

    const command = this.history.pop()
    return command.undoCommand() !== null
  }

  /**
   * Clear command history
   */
  clearHistory () {
    this.history = []
  }

  /**
   * Get command history
   * @returns {Array} Command history
   */
  getHistory () {
    return [...this.history]
  }
}
