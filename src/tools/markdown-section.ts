const MARKDOWN_HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;

/**
 * Slices the section starting at the first heading whose text contains
 * `headingText` (case-insensitive), up to the next heading of the same or
 * higher level. Returns null when no heading matches.
 */
export function sliceMarkdownSection(fullMarkdown: string, headingText: string): string | null {
  const markdownLines = fullMarkdown.split('\n');
  const normalizedHeadingText = headingText.toLowerCase();
  let sectionStartLineIndex = -1;
  let sectionHeadingLevel = 0;

  for (let lineIndex = 0; lineIndex < markdownLines.length; lineIndex++) {
    const headingMatch = (markdownLines[lineIndex] ?? '').match(MARKDOWN_HEADING_PATTERN);
    if (!headingMatch) {
      continue;
    }
    const headingLevel = (headingMatch[1] ?? '').length;
    const headingTitle = headingMatch[2] ?? '';
    if (sectionStartLineIndex === -1) {
      if (headingTitle.toLowerCase().includes(normalizedHeadingText)) {
        sectionStartLineIndex = lineIndex;
        sectionHeadingLevel = headingLevel;
      }
    } else if (headingLevel <= sectionHeadingLevel) {
      return markdownLines.slice(sectionStartLineIndex, lineIndex).join('\n');
    }
  }
  return sectionStartLineIndex === -1 ? null : markdownLines.slice(sectionStartLineIndex).join('\n');
}

/** Lists every heading line in the document (for "section not found" hints). */
export function listMarkdownHeadings(fullMarkdown: string): string[] {
  return fullMarkdown
    .split('\n')
    .filter((markdownLine) => MARKDOWN_HEADING_PATTERN.test(markdownLine))
    .map((headingLine) => headingLine.trim());
}
