/**
 * Function for parsing markdown content.
 * @param content
 */
export function parseMarkdown(content: string): string
{
    let lines = content.split('\n');
    let result = '';
    let inCodeBlock = false;
    let inTable = false;
    for ( let line of lines )
    {
        if ( line.trim() === '' )
            continue;
        if ( inCodeBlock )
        {
            if ( line.startsWith('```') )
            {
                inCodeBlock = false;
                result += '</span>';
            }
            else
                result += line + '\n';
        }
        else if ( inTable )
        {
            if ( line.startsWith('|') )
                result += parseLine(line);
            else
            {
                inTable = false;
                result += '</table>';
            }
        }
        else
        {
            if ( line.startsWith('```') )
            {
                inCodeBlock = true;
                result += '<span class="md md-code">';
            }
            else if ( line.startsWith('|') )
            {
                inTable = true;
                result += '<table class="md md-table">';
                result += parseLine(line);
            }
            else
                result += parseLine(line);
        }
    }
    return result;
}

/**
 * Function for parsing a single line of markdown content.
 * @param line
 */
function parseLine(line: string)
{
    // Check for headings.
    for ( let h = 6; h >= 1; h-- )
    {
        if ( line.startsWith('#'.repeat(h)) )
            return `<h${h} class="md md-heading md-heading-${h}">${line.substring(h + 1)}</h${h}>`;
    }
    // Check for lists.
    if ( line.startsWith('- ') || line.startsWith('* ') )
        return `<li class="md md-list-item">${line.substring(2)}</li>`;

    // Check for quotes.
    if ( line.startsWith('>') )
        return `<span class="md md-quote">&gt;&nbsp;${parseLine(line.substring(1))}</span>`

    if ( line.startsWith('---') )
        return `<span class="md md-line"></span>`

    // Check for bold text.
    if ( /(^|\s)\*\*.*\*\*(\s|$)/.test(line) )
        return `<span class="md md-bold">${line.replace(/\*\*/g, '')}</span>`;

    // check for bold text.
    if ( /(^|\s)__.*__(\s|$)/.test(line) )
        return `<span class="md md-bold">${line.replace(/__/g, '')}</span>`;

    // Check for italic text.
    if ( /(^|\s)\*.*\*(\s|$)/.test(line) )
        return `<span class="md md-italic">${line.replace(/\*/g, '')}</span>`;

    // Check for code blocks
    if ( /(^|\s)```.*```(\s|$)/.test(line) )
    {
        line = line
            .replaceAll(/</g, '&lt;')
            .replaceAll(/>/g, '&gt;');

        return `<span class="md md-code">${line.replace(/```/g, '')}</span>`;
    }

    // Check for code highlights
    if ( /(^|\s)`.*`(\s|$)/.test(line) )
        return `<span class="md md-code">${line.replace(/``/g, '')}</span>`;

    return `<span class="md md-paragraph">${line}</span>`;
}
