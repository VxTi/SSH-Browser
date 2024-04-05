/**
 * @file appstate.ts
 * @module appstate
 * @description Contains classes for managing application states and contexts.
 */

/**
 * The priority of the app context. Lowest number has the highest priority.
 */
export type ContextPriority = number;

/**
 * The possible events that can be triggered by the application context.
 */
export type AppContextEvent = 'load' | 'unload' | 'focus' | 'unfocus';

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
    onload: ((context: AppContext, ...parameters: any[]) => {})[] = [];

    /**
     * Function for handling the 'unload' event.
     */
    onunload: ((context: AppContext, ...parameters: any[]) => {})[] = [];

    /**
     * Function for handling the 'focus' event.
     */
    onfocus: ((context: AppContext, ...parameters: any[]) => {})[] = [];

    /**
     * Function for handling the 'unfocus' event.
     */
    onunfocus: ((context: AppContext, ...parameters: any[]) => {})[] = [];

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
    static create<T extends Element>(referenceElement: T): AppContext
    {
        return new AppContext( referenceElement );
    }

    /**
     * Function for registering an event handler.
     * If the event handler doesn't exist, a new handler will be created
     * and the callback will be added to the handler.
     * @param event The event to handle.
     * @param callback The callback function to call when the event is triggered.
     */
    on(event: AppContextEvent, callback: ((context: AppContext) => {})[]): void
    {
        // Check if the event is a valid event.
        // If it is, push the callback to the event handler.
        // Otherwise, create a new event handler.
        if ( this.hasOwnProperty( 'on' + event ) )
            this[ 'on' + event ].push( callback );
        else
            this[ 'on' + event ] = [ callback ];
    }

    /**
     * Function for emitting an event.
     * This only works when the event handlers are registered.
     * @param event The event to emit.
     * @param parameters The parameters to pass to the event handlers.
     */
    emit(event: AppContextEvent, ...parameters: any[]): void
    {
        // Check if the event is a valid event.
        // If it is, call all the event handlers.
        (this[ 'on' + event ] as ((context: AppContext, ...parameters: any[]) => {})[])?.forEach( callback => callback( this, ...parameters ) );
        console.trace( `Event '${ event }' emitted with parameters:`, parameters);
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
    private static __currentContext: AppContext;

    /**
     * A stack of all the contexts that are currently active.
     */
    private static __contextStack: AppContext[] = [];

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
        if ( this.__contextStack.some( ctx => ctx.contextId === context.contextId ) )
            throw new Error( `The context with the ID '${ context.contextId }' has already been registered.` );

        // Call the load event handlers.
        this.__currentContext.emit( 'load' );

        if ( setAsCurrent )
        {
            this.__currentContext = context;
            this.__currentContext.focussed = true;
            // Call the focus event handlers.
            this.__currentContext.emit( 'focus' );
        }
        else
        {
            // Push the context to the stack.
            this.__contextStack.push( context );
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
        if ( this.__currentContext != null && this.__currentContext.contextId === referenceId )
            return;

        // Find the context with the same ID as referenceId.
        for ( let ctx of this.__contextStack )
        {
            if ( ctx.contextId === referenceId )
            {
                // If there's a current context, push it to the
                // stack and set the new context as current.
                if ( this.__currentContext != null )
                {
                    this.__contextStack.push( this.__currentContext );
                    this.__currentContext.focussed = false;

                    // Call the 'onunfocus' event handlers.
                    this.__currentContext.emit( 'unfocus' );
                }

                // Set the new context as the current context,
                // and call the 'onfocus' event handlers.
                this.__currentContext = ctx;
                this.__currentContext.emit( 'focus')
                return; // Exit the function.
            }
        }
        throw new Error( `The context with the ID '${ referenceId }' has not been registered.` );
    }

    /**
     * Get the context stack of the application.
     */
    static get contextStack(): AppContext[]
    {
        return this.__contextStack;
    }

    /**
     * Clear the context stack.
     * This will remove all contexts from the stack.
     */
    static clearContextStack(): void
    {
        this.__contextStack = [];
    }

    /**
     * Get the current context ( highest priority ) of the application.
     */
    static get currentContext(): AppContext
    {
        return this.__currentContext;
    }

    /**
     * Removes the current context from the stack and sets the
     * previous context with the highest priority as the current context,
     * or the last context if all contexts have the same priority.
     * @throws Error when there are no contexts to pop, or when the context is already the last context.
     */
    static popContext(): void
    {
        if ( this.__contextStack.length === 0 )
            throw new Error( 'There are no contexts to pop.' );

        if ( this.__contextStack.length === 1 )
            throw new Error( 'The context is already the last context.' );

        this.__currentContext.onunfocus
            .forEach( callback => callback( this.__currentContext ) );
        this.__currentContext.onunload
            .forEach( callback => callback( this.__currentContext ) );

        // Remove the current context from the stack.
        this.__contextStack.pop();

        // Find the context with the highest priority.
        let firstCandidate: AppContext = this.__contextStack[ this.__contextStack.length - 1 ];
        let mainCandidate: AppContext = this.__contextStack[ this.__contextStack.length - 1 ];

        for ( let i = 0; i < this.__contextStack.length - 1; i++ )
        {
            if ( this.__contextStack[ i ].priority < mainCandidate.priority )
                mainCandidate = this.__contextStack[ i ];
        }

        if ( mainCandidate.priority === firstCandidate.priority )
            mainCandidate = firstCandidate;

        mainCandidate.focussed = true;
        this.__currentContext = mainCandidate;
        mainCandidate.emit( 'focus' );

    }

}

module.exports = { AppContext, AppState };