/**
 * Interface for the application state
 * This interface can be used to keep track of the current state of
 * the application, or used for keeping historical track.
 */

/**
 * The priority of the app context. Lowest number has the highest priority.
 */
type ContextPriority = number;

export interface IAppContext {

    /**
     * The current context ID. This is the same as the ID of the element.
     * Can later be used to keep track of which context is which.
     */
    contextId: string;

    /**
     * The priority of this application context.
     * This can be used to determine which context has task priority,
     */
    priority: ContextPriority;

    /**
     * The element that this context is associated with.
     */
    contentElement: typeof Element;

    /**
     * Whether this context is currently focussed.
     */
    focussed: boolean;

    /**
     * Whether to run background tasks.
     */
    backgroundUpdates: boolean;

    /**
     * Event handler for when the app context was loaded.
     * This can be used for initializing variables, adding elements, e.t.c.
     * @param event The 'load' event
     * @param callback The function that is called whenever the context was loaded.
     */
    on(event: 'load', callback: Function): void;

    /**
     * Event handler for when the app context was unloaded.
     * This can be used for cleaning up memory, or updating variables, e.t.c.
     * @param event The 'unload' event
     * @param callback The function that is called when the 'unload' function was called.
     */
    on(event: 'unload', callback: Function): void;

    /**
     * Event handler for when the app context focus was gained.
     * This can be used for adding elements to the screen, or starting
     * event handlers.
     * @param event The 'focus' event
     * @param callback The function that is called when the 'focus' function was called.
     */
    on(event: 'focus', callback: Function): void;

    /**
     * Event handler for when the app context focus was lost.
     * This can be used for removing elements from the screen, or pausing
     * event handlers.
     * @param event The 'unfocus' event
     * @param callback The function that is called when the 'unfocus' function was called.
     */
    on(event: 'unfocus', callback: Function): void;

}

/**
 * Class containing all possible application states.
 * Used to keep track of possible page changes, and reverting to previous states.
 */
export class AppState
{
    currentContext: IAppContext;
    contextStack: IAppContext[];

    private constructor(context: IAppContext) {
        this.contextStack = [];
        this.currentContext = context;
        this.contextStack.push(context);
    }

    /**
     * Function for changing the current context.
     * @param context The context to change to.
     */
    static useContext(context: IAppContext): AppState {
        return new AppState(context);
    }

}