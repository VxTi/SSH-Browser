/**
 * Interface for the application state
 * This interface can be used to keep track of the current state of
 * the application, or used for keeping historical track.
 */

/**
 * The priority of the app context. Lowest number has the highest priority.
 */
type ContextPriority = number;

type AppContextEvent = 'load' | 'unload' | 'focus' | 'unfocus';

type ContextEventCallbackArray = ((context: AppContext) => {})[];

export class AppContext
{
    /**
     * The current context ID. This is the same as the ID of the element.
     * Can later be used to keep track of which context is which.
     */
    contextId: string;

    /**
     * The priority of this application context.
     * This can be used to determine which context has task priority,
     */
    priority: ContextPriority = 1;

    /**
     * The element that this context is associated with.
     */
    contentElement: Element;

    /**
     * Whether this context is currently focussed.
     * By default is set to true when the context is created.
     */
    focussed: boolean = true;

    /**
     * Whether to run background tasks.
     */
    backgroundUpdates: boolean = false;

    /**
     * Function for handling the 'load' event.
     */
    onload: ((context: AppContext) => {})[] = [];

    /**
     * Function for handling the 'unload' event.
     */
    onunload: ((context: AppContext) => {})[] = [];

    /**
     * Function for handling the 'focus' event.
     */
    onfocus: ((context: AppContext) => {})[] = [];

    /**
     * Function for handling the 'unfocus' event.
     */
    onunfocus: ((context: AppContext) => {})[] = [];

    /**
     * Constructor for the AppContext class.
     * @param referenceElement The element that this context is associated with.
     * @private
     */
    private constructor(referenceElement: Element)
    {
        this.contentElement = referenceElement;
    }

    /**
     * Create a new AppContext instance.
     * @param referenceElement The element that this context is associated with.
     */
    static create(referenceElement: Element): AppContext
    {
        return new AppContext(referenceElement);
    }

    /**
     * Function for registering an event handler.
     * @param event The event to handle.
     * @param callback The callback function to call when the event is triggered.
     */
    on(event: AppContextEvent, callback: ((context: AppContext) => {})[]): void
    {
        // Check if the event is a valid event.
        // If it is, push the callback to the event handler.
        this[ 'on' + event ]?.push(callback);
    }
}

/**
 * Class containing all possible application states.
 * Used to keep track of possible page changes, and reverting to previous states.
 */
export class AppState
{
    /**
     * The current context of the application.
     */
    private static _currentContext: AppContext;

    /**
     * A stack of all the contexts that are currently active.
     */
    private static _contextStack: AppContext[] = [];

    /**
     * Constructor for the AppState class.
     * This class is a singleton and should not be instantiated.
     * @private
     */
    private constructor() {}

    /**
     * Function for changing the current context.
     * Whenever there's still a context active, it will be pushed to the stack
     * and the new context will be set as current.
     * @param context The context to add. This must be non-registered
     * @param setAsCurrent Whether to set the context as the current context.
     *                     If set to false, the context will only be pushed to the stack.
     * @throws Error when the context is already registered.
     */
    static pushContext(context: AppContext, setAsCurrent: boolean = true): void
    {
        if ( this._contextStack.some(ctx => ctx.contextId === context.contextId) )
            throw new Error(`The context with the ID '${context.contextId}' has already been registered.`);

        // Call the 'onload' event handlers.
        this._currentContext.onload
            .forEach(callback => callback(this._currentContext));

        if ( setAsCurrent )
        {
            this._currentContext = context;
            this._currentContext.focussed = true;
            // Call the 'onfocus' event handlers.
            this._currentContext.onfocus
                .forEach(callback => callback(this._currentContext));
        }
        else
        {
            this._contextStack.push(context);
        }
    }

    /**
     * Function for switching to a different context.
     * This function can accept either an app context or a context ID.
     * If the context ID isn't registered, nothing happens.
     * When an app context instance is provided, the AppState will
     * switch to the provided context and push the current context to the stack. (if available)
     * @param context The ID or context to switch to.
     * @throws Error when the context with the ID isn't registered.
     */
    static switchContext(context: string | AppContext): void
    {
        // If the context is a string, find the context with the same ID.
        // otherwise, use the provided context instance;
        let referenceId = context instanceof AppContext ? context.contextId : context;

        // If the context is already the current context, return.
        if ( this._currentContext != null && this._currentContext.contextId === referenceId )
            return;

        // Find the context with the same ID as referenceId.
        for ( let ctx of this._contextStack )
        {
            if ( ctx.contextId === referenceId )
            {
                // If there's a current context, push it to the
                // stack and set the new context as current.
                if ( this._currentContext != null )
                {
                    this._contextStack.push(this._currentContext);
                    this._currentContext.focussed = false;

                    // Call the 'onunfocus' event handlers.
                    this._currentContext.onunfocus
                        .forEach(callback => callback(this._currentContext));
                }

                // Set the new context as the current context,
                // and call the 'onfocus' event handlers.
                this._currentContext = ctx;
                this._currentContext.onfocus
                    .forEach(callback => callback(this._currentContext));

                return; // Exit the function.
            }
        }
        throw new Error(`The context with the ID '${referenceId}' has not been registered.`);
    }

    /**
     * Get the context stack of the application.
     */
    static get contextStack(): AppContext[]
    {
        return this._contextStack;
    }

    /**
     * Clear the context stack.
     * This will remove all contexts from the stack.
     */
    static clearContextStack(): void
    {
        this._contextStack = [];
    }

    /**
     * Get the current context ( highest priority ) of the application.
     */
    static get currentContext(): AppContext
    {
        return this._currentContext;
    }

    /**
     * Removes the current context from the stack and sets the
     * previous context with the highest priority as the current context,
     * or the last context if all contexts have the same priority.
     */
    static popContext(): void
    {
        this._currentContext.onunfocus
            .forEach(callback => callback(this._currentContext));
        this._currentContext.onunload
            .forEach(callback => callback(this._currentContext));
    }

}