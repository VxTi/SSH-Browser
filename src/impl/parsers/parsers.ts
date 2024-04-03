import { parseMarkdown } from './markdown-parser';

type ContentType = ('text/markdown' | 'text/plain');

interface Parser {
    contentType: ContentType;
    parser: (content: string) => string;
}

// The parser object that contains the content type and the parser function.
const __parsers: Parser[] = [
    {
        contentType: 'text/markdown',
        parser: parseMarkdown
    }
]

/**
 * Function for parsing content based on the content type.
 * @param contentType The type of content. This is used to determine which parser to use.
 * @param content The content to parse.
 */
export default function toHtml(contentType: ContentType, content: string): string
{
    let parser = __parsers.find(parser => parser.contentType === contentType);
    if ( parser )
        return parser.parser(content);
    return content;
}
