/**
 * @fileoverview This file contains the implementation for an abstract hierarchy builder.
 */


/** @type {{ state: ('expanded' | 'collapsed' | 'non-expandable'), title: string, indentation: number, uid: string }[]} */
let hierarchyElementCache = [];

/**
 * The function that is called for retrieving the hierarchy elements from
 * an arbitrary location.
 * @param {string} uid The UID of the element to retrieve the hierarchy from.
 * @returns {[{ expandable: boolean, title: string, uid: any }]}
 * @private
 */
let __hierarchyRetrievalFn = (uid) => [];
/**
 * The function that is called whenever a hierarchy element is opened.
 * @param {string} uid The UID of the opened element.
 * @private
 */
let __hierarchyOpenFn = (uid) => {};

/**
 * The function that is called whenever elements are retrieved from the hierarchy.
 * These elements are retrieved from the retrieval function.
 * This function is called for each element that is retrieved.
 * @param {{title: string, uid: string }} entry The retrieved element.
 * @param {number} index The index of the element in the hierarchy.
 * @private
 */
let __hierarchyRetrievedFn = (entry, index) => {};

/**
 * The function that is called whenever an element is collapsed.
 * The function parameter is the UID of the element that is collapsed.
 * @param {string} uid The UID of the collapsed element.
 * @param {number} index The index of the element in the hierarchy.
 * @private
 */
let __hierarchyCollapseFn = (uid, index) => {};

/**
 * Function for setting the retrieval function for the abstract hierarchy.
 * This function is used to retrieve the sub hierarchies. This can be whatever
 * one decides to implement.
 * @param {Function} retrievalFn The retrieval function. This function must return an array of objects
 * containing the following properties, with the following types:
 * - expandable: boolean
 * - title: string
 * - uid: any
 */
function retrievesHow(retrievalFn)
{
    if ( typeof retrievalFn === 'function' )
        __hierarchyRetrievalFn = retrievalFn;
}

/**
 * Function for setting the function that is called whenever an element
 * is opened in the hierarchy.
 * @param {Function} openFn The provided function.
 */
function whenOpened(openFn)
{
    if ( typeof openFn === 'function' )
        __hierarchyOpenFn = openFn;
}

/**
 * Function for setting the function that is called whenever the hierarchy
 * elements are successfully retrieved.
 * This can be used for adding elements to the DOM, for example.
 * @param {Function} retrievedFn The provided function.
 */
function whenRetrieved(retrievedFn)
{
    if ( typeof retrievedFn === 'function' )
        __hierarchyRetrievedFn = retrievedFn;
}

/**
 * Function for setting the function that is called whenever a hierarchy element
 * is collapsed. The function parameter is a string containing the UID of the element.
 * @param {Function} collapseFn The provided function.
 */
function whenCollapsed(collapseFn)
{
    if ( typeof collapseFn === 'function' )
        __hierarchyCollapseFn = collapseFn;
}

/**
 * Function for expanding, collapsing or opening the hierarchy from a specified
 * hierarchy element.
 * @param {string} uid The UID of the element to expand.
 */
function interact(uid)
{
    let [element, index] = getElement(uid);

    if ( !element )
    {
        console.log("Retrieving hierarchy from " + uid)
        __hierarchyRetrievalFn(uid)
            .filter(entry =>
                entry.hasOwnProperty('expandable') &&
                entry.hasOwnProperty('title') &&
                entry.hasOwnProperty('uid') )
            .forEach((entry, i) => {
                // Insert the element into the cache at the correct index,
                // and call the retrieved function.
                hierarchyElementCache.splice(index + i, 0, {
                    state: entry.expandable ? 'collapsed' : 'non-expandable',
                    title: entry.title,
                    indentation: 0,
                    uid: entry.uid
                });
                __hierarchyRetrievedFn({ title: entry.title, uid: entry.uid }, i);
            });
        return;
    }

    // If the element is non-expandable, we call the open function.
    // The user can decide whatever happens when the element is non-expandable.
    if ( element.state === 'non-expandable' )
    {
        console.log("Opening non-expandable element " + element.title)
        __hierarchyOpenFn(element['uid']);
    }
    // Expand the element if it's collapsed.
    else if ( element.state === 'collapsed' )
    {
        console.log("Expanding element " + element.title)
        expand(element, index);
    }
    // Collapse the element if it's expanded.
    else
    {
        console.log("Collapsing element " + element.title)
        collapse(element, index);
    }
}

/**
 * Function for opening a hierarchy element.
 * @param {{ state: ('expanded' | 'collapsed' | 'non-expandable'), title: string, indentation: number, uid: string }} element The element to open.
 * @param {number} index The index of the element in the hierarchy.
 */
function collapse(element, index)
{
    for ( let i = index; i < hierarchyElementCache.length; i++ )
    {
        if ( hierarchyElementCache[i].indentation >= element.indentation )
        {
            hierarchyElementCache[i].state = 'collapsed';
            __hierarchyCollapseFn(uid, i);
        }
        else
            break;
    }
}

/**
 * Function for expanding a hierarchy element.
 * @param {{ state: ('expanded' | 'collapsed' | 'non-expandable'), title: string, indentation: number, uid: string }} element The element to expand.
 * @param {number} index The index of the element in the hierarchy.
 */
function expand(element, index)
{
    element.state = 'expanded';
    __hierarchyRetrievalFn(element.uid)
        .filter(entry =>
            entry.hasOwnProperty('expandable') &&
            entry.hasOwnProperty('title') &&
            entry.hasOwnProperty('uid') )
        .forEach((entry, i) => {
            // Insert the element into the cache at the correct index,
            // and call the retrieved function.
            hierarchyElementCache.splice(index + i, 0, {
                state: entry.expandable ? 'collapsed' : 'non-expandable',
                title: entry.title,
                indentation: element.indentation + 1,
                uid: entry.uid
            });
            __hierarchyRetrievedFn({ title: entry.title, uid: entry.uid }, index + i);
        });
}

/**
 * Function for retrieving the element from the cache.
 * @param {string} uid The UID of the element to retrieve.
 * @returns {[{ state: ('expanded' | 'collapsed' | 'non-expandable'), title: string, indentation: number, uid: string } | null, number]}
 */
function getElement(uid)
{
    let element = null, index = -1;

    hierarchyElementCache.forEach((entry, i) => {
        if ( entry.uid === uid )
        {
            element = entry;
            index = i;
        }
    });
    return [element, index];
}



module.exports = {
    retrievesHow,
    whenOpened,
    whenRetrieved,
    whenCollapsed,
    interact,
    collapse,
    expand
}