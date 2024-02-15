


exports.taskQueue = []

export default class Task {

    /** @type function */
    #func
    #executed = false
    #delay = 0
    /** @type Task */
    #taskAfter
    /** @type {string | undefined} */
    #title

    constructor(func, title = undefined)
    {
        this.#func = func
        this.#title = title
        exports.taskQueue.push(this)
    }

    /**
     * Getter for whether the task has been executed or not.
     * @returns {boolean}
     */
    get executed()
    {
        return this.#executed
    }

    get title()
    {
        return this.#title || "Generic Task"
    }

    /**
     * Setter for the interval after which the task will be executed.
     * @param interval
     */
    set interval(interval)
    {
        this.#delay = interval
    }

    /**
     * Method for scheduling a task to run after this one.
     * If the after task is already defined, it'll schedule it after that one.
     * @param {Task} task The task to schedule.
     */
    after(task)
    {
        if (this.#taskAfter != null)
            this.#taskAfter.after(task)
        else this.#taskAfter = task
    }

    /**
     * Method for executing this task.
     * If there's other tasks that are scheduled to run after this one
     * then they'll be executed as well.
     */
    execute()
    {
        if (this.#delay === 0)
            this.#func()
        else setTimeout(this.#func, this.#delay)
        this.#executed = true
        this.#taskAfter?.execute()
    }
}

/**
 * Method for executing all the tasks in the queue.
 */
export function executeTasks()
{
    while (exports.taskQueue.length > 0)
        exports.taskQueue.shift().execute()
}

/**
 * Method for adding a task to the task queue
 */
export function queueTasks(...task)
{
    exports.taskQueue.push(task)
}
