// PaddleOCR-VL returns each page as Markdown mixed with HTML: headings,
// emphasis, pipe or HTML tables, image placeholders, and LaTeX. Chunking and
// quote verification need only the readable words, so this keeps the text and
// its line structure and drops the markup. LaTeX stays as written.

// Matching known tag names, not any `<x...>`, keeps comparisons such as `x<y`.
const HTML_TAG =
  /<\/?(?:a|b|body|br|caption|center|code|col|colgroup|del|div|em|figcaption|figure|font|h[1-6]|head|hr|html|i|img|ins|li|mark|ol|p|pre|s|section|small|span|strong|sub|sup|table|tbody|td|tfoot|th|thead|tr|u|ul)(?:\s[^<>]*)?\/?>/gi
const BLOCK_END_TAG = /<\/(?:caption|div|figcaption|figure|h[1-6]|li|ol|p|pre|section|table|tbody|tfoot|thead|tr|ul)\s*>/gi
const CELL_END_TAG = /<\/(?:td|th)\s*>/gi
const LINE_BREAK_TAG = /<br\s*\/?>/gi

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: '\'',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity: string, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X'
      const codePoint = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity
  })

// `| a | b |` rows become `a b`; `| --- | :-: |` separator rows disappear.
const flattenTableRow = (line: string): string => {
  const trimmed = line.trim()
  if (trimmed.includes('|') && trimmed.includes('-') && /^[|:\s-]+$/.test(trimmed)) {
    return ''
  }
  if (!trimmed.startsWith('|')) {
    return line
  }
  return trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)
    .join(' ')
}

export function cloudMarkdownToPlainText(markdown: string): string {
  let text = markdown.replace(/\r\n?/g, '\n')

  // Comments and images carry no readable text.
  text = text.replace(/<!--[\s\S]*?-->/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')

  // Links keep their label and lose the URL; autolinks keep the bare address.
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<(https?:\/\/[^>\s]+)>/gi, '$1')

  // HTML structure becomes line breaks or spaces, then the tags go.
  text = text
    .replace(LINE_BREAK_TAG, '\n')
    .replace(BLOCK_END_TAG, '\n')
    .replace(CELL_END_TAG, ' ')
    .replace(HTML_TAG, '')

  // Block markers: code fences, headings, block quotes, rules and setext underlines.
  text = text
    .replace(/^[ \t]*(?:```|~~~).*$/gm, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/gm, '$1')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*$/gm, '')
    .replace(/^[ \t]{0,3}(?:>[ \t]?)+/gm, '')
    .replace(/^[ \t]*(?:[-*_=][ \t]*){3,}$/gm, '')

  text = text.split('\n').map(flattenTableRow).join('\n')

  // Inline markers: bold, strikethrough, italics, and code spans.
  text = text
    .replace(/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, '$2')
    .replace(/~~(?=\S)([^\n]*?\S)~~/g, '$1')
    .replace(/(^|[^\w*\\])\*(?=[^\s*])([^*\n]*?[^\s*\\])\*(?![\w*])/gm, '$1$2')
    .replace(/(^|[^\w\\])_(?=[^\s_])([^_\n]*?[^\s_\\])_(?!\w)/gm, '$1$2')
    .replace(/`+([^`\n]+)`+/g, '$1')
    // Backslash escapes such as \* or \_ keep only the character.
    .replace(/\\([\\`*_{}[\]()#+.!|>~-])/g, '$1')

  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v\u00a0]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
