/**
 * HtmlSimplifier – Convert HTML to Markdown or plain text
 *
 * Provides functions to simplify HTML content for LLM processing:
 * - htmlToMarkdown: Converts HTML to Markdown format
 * - htmlToText: Extracts plain text from HTML
 * - isHtmlContent: Checks if content appears to be HTML
 */

/**
 * Check if content appears to be HTML
 */
export function isHtmlContent(content: string): boolean {
  if (!content || content.trim().length === 0) {
    return false;
  }
  const trimmed = content.trim();
  // Check for common HTML indicators
  return (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML') ||
    /<[a-z][\s\S]*>/i.test(trimmed)
  );
}

/**
 * Extract plain text from HTML, removing all tags, scripts, styles, and comments
 */
export function htmlToText(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Replace multiple newlines with double newline (paragraph breaks)
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  return text;
}

/**
 * Convert HTML to simple markdown (based on html-to-markdown library approach)
 */
export function htmlToMarkdown(html: string): string {
  // Remove script, style, and noscript tags with their content
  let doc = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  doc = doc.replace(/<style[\s\S]*?<\/style>/gi, '');
  doc = doc.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  doc = doc.replace(/<!--[\s\S]*?-->/g, '');

  // Apply conversion functions in order (based on html-to-markdown approach)
  doc = replaceHeading(doc);
  doc = replaceParagraph(doc);
  doc = replacePre(doc);
  doc = replaceCode(doc);
  doc = replaceUl(doc);
  doc = replaceOl(doc);
  doc = replaceBold(doc);
  doc = replaceItalic(doc);
  doc = replaceBlockQuote(doc);
  doc = replaceHref(doc);
  doc = replaceBr(doc);

  // Remove all remaining HTML tags
  doc = doc.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  doc = doc
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Normalize whitespace
  doc = doc.replace(/\n{3,}/g, '\n\n').trim();

  return doc;
}

// ─── Helper functions for Markdown conversion ────────────────────────────────

function makeRegex(
  regex: RegExp,
  doc: string,
  before?: string,
  after?: string,
  replaceFn?: (matches: RegExpExecArray) => string,
): string {
  const matches: RegExpExecArray[] = [];
  let newDoc = doc;
  let match: RegExpExecArray | null;

  // Reset regex lastIndex for global regex
  regex.lastIndex = 0;

  while ((match = regex.exec(doc)) !== null) {
    if (match && match[1]) {
      let replaceString = before || '';
      let replaceText = match[1].trim();
      if (replaceFn && typeof replaceFn === 'function') {
        replaceText = replaceFn(match);
      }
      replaceString += replaceText;
      replaceString += after || '';
      newDoc = newDoc.replace(match[0], replaceString);
    }
  }

  return newDoc;
}

function replaceHeading(doc: string): string {
  const headingRegex = /<h(\d+)[^>]*>([\s\S]*?)<\/h\d+>/gim;
  return makeRegex(headingRegex, doc, undefined, undefined, (match) => {
    return addHashes(Number(match[1])) + ' ' + match[2];
  });
}

function replaceParagraph(doc: string): string {
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gim;
  return makeRegex(pRegex, doc);
}

function replacePre(doc: string): string {
  const preRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gim;
  return makeRegex(preRegex, doc, '```', '```');
}

function replaceCode(doc: string): string {
  // Only replace code tags that are NOT inside pre tags
  // First handle pre+code blocks, then standalone code
  const preCodeRegex = /<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gim;
  doc = makeRegex(preCodeRegex, doc, '```', '```');
  
  const codeRegex = /<code[^>]*>([\s\S]*?)<\/code>/gim;
  return makeRegex(codeRegex, doc, '`', '`');
}

function replaceUl(doc: string): string {
  const ulRegex = /<ul[^>]*>([\s\S]*?)<\/ul>/gim;
  return makeRegex(ulRegex, doc, undefined, undefined, (match) => {
    return replaceLi(match[1], 'ul');
  });
}

function replaceOl(doc: string): string {
  const olRegex = /<ol[^>]*>([\s\S]*?)<\/ol>/gim;
  return makeRegex(olRegex, doc, undefined, undefined, (match) => {
    return replaceLi(match[1], 'ol');
  });
}

function replaceBold(doc: string): string {
  const boldRegex = /<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/gim;
  return makeRegex(boldRegex, doc, '**', '**');
}

function replaceItalic(doc: string): string {
  const italicRegex = /<(?:i|em)[^>]*>([\s\S]*?)<\/(?:i|em)>/gim;
  return makeRegex(italicRegex, doc, '*', '*');
}

function replaceBlockQuote(doc: string): string {
  const blockQuoteRegex = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gim;
  return makeRegex(blockQuoteRegex, doc, '> ', undefined);
}

function replaceHref(doc: string): string {
  const hrefRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gim;
  return makeRegex(hrefRegex, doc, undefined, undefined, (match) => {
    return `[${match[2]}](${match[1]})`;
  });
}

function replaceBr(doc: string): string {
  const brRegex = /<br\s*\/?>/gim;
  return doc.replace(brRegex, '\n');
}

function replaceLi(doc: string, tag: string): string {
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gim;
  let newDoc = doc;
  let replaceIndex = 0;
  let match: RegExpExecArray | null;

  liRegex.lastIndex = 0;

  while ((match = liRegex.exec(doc)) !== null) {
    if (match && match[1]) {
      let replaceTag = '';
      if (tag !== 'ul') {
        replaceIndex++;
        replaceTag = `${replaceIndex}. `;
      } else {
        replaceTag = '- ';
      }
      newDoc = newDoc.replace(match[0], replaceTag + match[1].trim() + '\n');
    }
  }

  return newDoc;
}

function addHashes(count: number): string {
  let string = '';
  for (let x = 0; x < count; x++) {
    string += '#';
  }
  return string;
}
