import fs from "fs";
import * as JSZip from "jszip";
import path from "path";
import { decodeXmlEntities, extractComments, WordComment } from "./docx-utils";

/**
 * Represents a tracked change (insertion or deletion)
 */
interface TrackedChange {
    type: "add" | "delete";
    text: string;
    paragraphNumber: number;
    // Full context: all text before and after the change in the paragraph
    fullContextBefore: string;
    fullContextAfter: string;
}

/**
 * Represents the diff output structure
 */
export interface GitDiffOutput {
    filename: string;
    changes: TrackedChange[];
    comments: WordComment[];
    // Full document text for uniqueness checking
    fullText: string;
}

/**
 * Process a Word document and generate git-style diff output with comments
 */
export async function generateGitDiff(filePath: string): Promise<GitDiffOutput> {
    const buffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")?.async("string");

    if (!documentXml) {
        throw new Error("Could not extract document.xml from the Word document");
    }

    const filename = path.basename(filePath);
    const { changes, fullText } = extractTrackedChanges(documentXml);
    const comments = await extractComments(filePath);

    return {
        filename,
        changes,
        comments,
        fullText,
    };
}

/**
 * Extract tracked changes from document XML with full context
 */
function extractTrackedChanges(xml: string): {
    changes: TrackedChange[];
    fullText: string;
} {
    const changes: TrackedChange[] = [];
    const paragraphTexts: string[] = [];

    // Find all paragraphs first
    const paragraphs: {
        start: number;
        end: number;
        content: string;
        text: string;
    }[] = [];
    let currentPos = 0;
    let startTagPos = xml.indexOf("<w:p", currentPos);

    while (startTagPos !== -1) {
        const endTagPos = xml.indexOf("</w:p>", startTagPos);
        if (endTagPos === -1) break;

        const paragraphContent = xml.substring(
            xml.indexOf(">", startTagPos) + 1,
            endTagPos,
        );

        // Extract plain text from paragraph (including tracked change text for full context)
        const plainText = extractAllText(paragraphContent);

        paragraphs.push({
            start: startTagPos,
            end: endTagPos + 6,
            content: paragraphContent,
            text: plainText,
        });

        paragraphTexts.push(plainText);

        currentPos = endTagPos + 6;
        startTagPos = xml.indexOf("<w:p", currentPos);
    }

    const fullText = paragraphTexts.join("\n");

    // Process each paragraph for tracked changes
    for (let paragraphIdx = 0; paragraphIdx < paragraphs.length; paragraphIdx++) {
        const paragraph = paragraphs[paragraphIdx];
        const paragraphNumber = paragraphIdx + 1;

        // Process insertions
        const insertions = extractChangesOfType(paragraph.content, "ins", paragraphNumber);
        changes.push(...insertions.map(c => ({
            ...c,
            type: "add" as const,
        })));

        // Process deletions
        const deletions = extractChangesOfType(paragraph.content, "del", paragraphNumber);
        changes.push(...deletions.map(c => ({
            ...c,
            type: "delete" as const,
        })));
    }

    return {
        changes,
        fullText,
    };
}

/**
 * Extract changes of a specific type (ins or del) from paragraph content
 */
function extractChangesOfType(
    paragraphContent: string,
    changeType: "ins" | "del",
    paragraphNumber: number,
): Omit<TrackedChange, "type">[] {
    const changes: Omit<TrackedChange, "type">[] = [];
    const tagStart = `<w:${changeType}`;
    const tagEnd = `</w:${changeType}>`;

    let currentPos = 0;
    let changeStartPos = paragraphContent.indexOf(tagStart, currentPos);

    while (changeStartPos !== -1) {
        const changeEndPos = paragraphContent.indexOf(tagEnd, changeStartPos);
        if (changeEndPos === -1) break;

        const changeContent = paragraphContent.substring(changeStartPos, changeEndPos + tagEnd.length);
        const changeText = changeType === "del"
            ? extractDeletedText(changeContent)
            : extractTextFromRuns(changeContent);

        if (changeText) {
            // Extract full context before the change
            const beforeContent = paragraphContent.substring(0, changeStartPos);
            const fullContextBefore = extractAllText(beforeContent);

            // Extract full context after the change
            const afterContent = paragraphContent.substring(changeEndPos + tagEnd.length);
            const fullContextAfter = extractAllText(afterContent);

            changes.push({
                text: changeText,
                paragraphNumber,
                fullContextBefore,
                fullContextAfter,
            });
        }

        currentPos = changeEndPos + tagEnd.length;
        changeStartPos = paragraphContent.indexOf(tagStart, currentPos);
    }

    return changes;
}

/**
 * Extract all text from XML content (including text in tracked changes)
 */
function extractAllText(xml: string): string {
    let text = "";

    // Extract from w:t elements
    const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
    let match;
    while ((match = textRegex.exec(xml)) !== null) {
        text += decodeXmlEntities(match[1]);
    }

    // Also extract from w:delText elements
    const delTextRegex = /<w:delText\b[^>]*>(.*?)<\/w:delText>/gs;
    while ((match = delTextRegex.exec(xml)) !== null) {
        text += decodeXmlEntities(match[1]);
    }

    return text;
}

/**
 * Extract text from w:r (run) elements
 */
function extractTextFromRuns(xml: string): string {
    let text = "";
    const regex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
    let match;

    while ((match = regex.exec(xml)) !== null) {
        text += decodeXmlEntities(match[1]);
    }

    return text;
}

/**
 * Extract deleted text (from w:delText elements)
 */
function extractDeletedText(xml: string): string {
    let text = "";

    // Try delText first
    const delTextRegex = /<w:delText\b[^>]*>(.*?)<\/w:delText>/gs;
    let match;
    let hasDelText = false;

    while ((match = delTextRegex.exec(xml)) !== null) {
        text += decodeXmlEntities(match[1]);
        hasDelText = true;
    }

    // Fallback to regular text if no delText found
    if (!hasDelText) {
        const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
        while ((match = textRegex.exec(xml)) !== null) {
            text += decodeXmlEntities(match[1]);
        }
    }

    return text;
}

/**
 * Find the minimum unique context for a change
 * Expands context until it's unique within the document
 */
function findUniqueContext(
    change: TrackedChange,
    fullText: string,
    minLength: number = 10,
    maxLength: number = 100,
): {
    before: string;
    after: string;
} {
    const { fullContextBefore, fullContextAfter } = change;

    // Start with minimum context
    let beforeLen = Math.min(minLength, fullContextBefore.length);
    let afterLen = Math.min(minLength, fullContextAfter.length);

    // Build the context string and check uniqueness
    const buildContext = (bLen: number, aLen: number): string => {
        const before = fullContextBefore.slice(-bLen);
        const after = fullContextAfter.slice(0, aLen);
        return before + after;
    };

    // Count occurrences of a context string in the full text
    const countOccurrences = (context: string): number => {
        if (!context || context.length === 0) return 0;
        let count = 0;
        let pos = 0;
        while ((pos = fullText.indexOf(context, pos)) !== -1) {
            count++;
            pos += 1;
        }
        return count;
    };

    // Expand context until unique or max reached
    while (beforeLen <= maxLength || afterLen <= maxLength) {
        const context = buildContext(beforeLen, afterLen);
        const occurrences = countOccurrences(context);

        if (occurrences <= 1) {
            // Context is unique
            break;
        }

        // Expand both sides proportionally
        if (beforeLen < fullContextBefore.length && beforeLen <= afterLen) {
            beforeLen = Math.min(beforeLen + 10, fullContextBefore.length, maxLength);
        }
        else if (afterLen < fullContextAfter.length) {
            afterLen = Math.min(afterLen + 10, fullContextAfter.length, maxLength);
        }
        else if (beforeLen < fullContextBefore.length) {
            beforeLen = Math.min(beforeLen + 10, fullContextBefore.length, maxLength);
        }
        else {
            // Can't expand further
            break;
        }
    }

    // Format the final context
    let before = fullContextBefore.slice(-beforeLen).trim();
    let after = fullContextAfter.slice(0, afterLen).trim();

    // Add ellipsis if truncated
    if (beforeLen < fullContextBefore.length && before.length > 0) {
        before = "..." + before;
    }
    if (afterLen < fullContextAfter.length && after.length > 0) {
        after = after + "...";
    }

    return {
        before,
        after,
    };
}

const FORMAT_HEADER = `# Word Document Diff (Modified Format)
# =====================================
# This is a modified diff format for Word documents with tracked changes.
#
# Format:
#   +line = added text
#   -line = deleted text
#   > [author]: comment text (interspersed with changes in document order)
#   @@ paragraph N @@ = paragraph number where changes occur
#
# Context (after #):
#   "before [...] after" = surrounding text with [...] marking where the change occurs
#   "before [selected] after" = for comments, [brackets] mark the commented text
#   "before>|<after" = for point comments (no selection), >|< marks cursor position
#   ... = truncated text
#   Context auto-expands until unique in the document
#
# Special characters:
#   ␊ = newline (for multiline comments or selections)
#
`;

/**
 * Represents an item (change or comment) for ordering in output
 */
interface OutputItem {
    type: "change" | "comment";
    paragraphNumber: number;
    change?: TrackedChange;
    comment?: WordComment;
}

/**
 * Format the diff output as a git-style unified diff
 */
export function formatAsGitDiff(output: GitDiffOutput): string {
    const lines: string[] = [];

    // Format header explaining the format
    lines.push(FORMAT_HEADER);

    // File header
    lines.push(`diff --word a/${output.filename} b/${output.filename}`);
    lines.push(`--- a/${output.filename}`);
    lines.push(`+++ b/${output.filename}`);

    // Combine changes and comments into a single list for ordering
    const items: OutputItem[] = [];

    for (const change of output.changes) {
        items.push({
            type: "change",
            paragraphNumber: change.paragraphNumber,
            change,
        });
    }

    for (const comment of output.comments) {
        items.push({
            type: "comment",
            paragraphNumber: comment.paragraphNumber,
            comment,
        });
    }

    // Sort by paragraph number (changes and comments interleaved)
    items.sort((a, b) => {
        if (a.paragraphNumber !== b.paragraphNumber) {
            return a.paragraphNumber - b.paragraphNumber;
        }
        // Within same paragraph, changes come before comments
        if (a.type !== b.type) {
            return a.type === "change" ? -1 : 1;
        }
        return 0;
    });

    // Output items grouped by paragraph
    let currentParagraph = -1;

    for (const item of items) {
        // Output paragraph header when entering a new paragraph
        if (item.paragraphNumber !== currentParagraph) {
            currentParagraph = item.paragraphNumber;
            lines.push(`@@ paragraph ${currentParagraph} @@`);
        }

        if (item.type === "change" && item.change) {
            const change = item.change;
            const { before, after } = findUniqueContext(change, output.fullText);
            const contextQuote = formatContextQuote(before, after);

            if (change.type === "delete") {
                lines.push(`-${change.text}${contextQuote}`);
            }
            else {
                lines.push(`+${change.text}${contextQuote}`);
            }
        }
        else if (item.type === "comment" && item.comment) {
            const comment = item.comment;
            const uniqueContext = findUniqueContextForComment(comment, output.fullText);
            const commentText = escapeNewlines(comment.text);
            const contextText = escapeNewlines(uniqueContext);
            lines.push(`> [${comment.author}]: ${commentText}  # "${contextText}"`);
        }
    }

    return lines.join("\n");
}

/**
 * Find unique context for a comment's anchored text
 * Always shows the full selected/anchored text, but expands surrounding context if not unique
 * For point comments (no selection), shows surrounding context with | marking the cursor position
 */
function findUniqueContextForComment(
    comment: WordComment,
    fullText: string,
    maxContextLength: number = 30,
): string {
    const { anchoredText, contextBefore, contextAfter } = comment;

    // Point comment (no text selected) - show context around cursor position
    if (!anchoredText) {
        return findUniquePointContext(contextBefore, contextAfter, fullText, maxContextLength);
    }

    // Check if anchored text alone is unique
    const occurrences = countOccurrences(anchoredText, fullText);
    if (occurrences <= 1) {
        // Unique - just return the anchored text
        return anchoredText;
    }

    // Not unique - need to expand context around the anchored text
    let beforeLen = 0;
    let afterLen = 0;

    // Expand context until unique or max reached
    while (beforeLen < maxContextLength || afterLen < maxContextLength) {
        const before = beforeLen > 0 ? contextBefore.slice(-beforeLen) : "";
        const after = afterLen > 0 ? contextAfter.slice(0, afterLen) : "";
        const fullContext = before + anchoredText + after;

        const contextOccurrences = countOccurrences(fullContext, fullText);
        if (contextOccurrences <= 1) {
            // Found unique context
            break;
        }

        // Expand both sides
        if (beforeLen <= afterLen && beforeLen < contextBefore.length) {
            beforeLen = Math.min(beforeLen + 10, contextBefore.length, maxContextLength);
        }
        else if (afterLen < contextAfter.length) {
            afterLen = Math.min(afterLen + 10, contextAfter.length, maxContextLength);
        }
        else if (beforeLen < contextBefore.length) {
            beforeLen = Math.min(beforeLen + 10, contextBefore.length, maxContextLength);
        }
        else {
            // Can't expand further
            break;
        }
    }

    // Format the result
    let before = beforeLen > 0 ? contextBefore.slice(-beforeLen).trim() : "";
    let after = afterLen > 0 ? contextAfter.slice(0, afterLen).trim() : "";

    // Add ellipsis if truncated
    if (beforeLen > 0 && beforeLen < contextBefore.length) {
        before = "..." + before;
    }
    if (afterLen > 0 && afterLen < contextAfter.length) {
        after = after + "...";
    }

    // Build the final string with anchored text always in full
    const parts: string[] = [];
    if (before) {
        parts.push(before);
    }
    parts.push(`[${anchoredText}]`); // Brackets to clearly mark the selected text
    if (after) {
        parts.push(after);
    }

    return parts.join(" ");
}

/**
 * Find unique context for a point comment (cursor position, no text selected)
 * Uses | to mark the cursor position
 */
function findUniquePointContext(
    contextBefore: string,
    contextAfter: string,
    fullText: string,
    maxContextLength: number = 30,
): string {
    // Start with some context on each side
    let beforeLen = Math.min(15, contextBefore.length);
    let afterLen = Math.min(15, contextAfter.length);

    // Expand context until unique or max reached
    while (beforeLen < maxContextLength || afterLen < maxContextLength) {
        const before = contextBefore.slice(-beforeLen);
        const after = contextAfter.slice(0, afterLen);
        const fullContext = before + after;

        const contextOccurrences = countOccurrences(fullContext, fullText);
        if (contextOccurrences <= 1) {
            // Found unique context
            break;
        }

        // Expand both sides
        if (beforeLen <= afterLen && beforeLen < contextBefore.length) {
            beforeLen = Math.min(beforeLen + 10, contextBefore.length, maxContextLength);
        }
        else if (afterLen < contextAfter.length) {
            afterLen = Math.min(afterLen + 10, contextAfter.length, maxContextLength);
        }
        else if (beforeLen < contextBefore.length) {
            beforeLen = Math.min(beforeLen + 10, contextBefore.length, maxContextLength);
        }
        else {
            // Can't expand further
            break;
        }
    }

    // Format the result
    let before = contextBefore.slice(-beforeLen).trim();
    let after = contextAfter.slice(0, afterLen).trim();

    // Add ellipsis if truncated
    if (beforeLen < contextBefore.length && before.length > 0) {
        before = "..." + before;
    }
    if (afterLen < contextAfter.length && after.length > 0) {
        after = after + "...";
    }

    // Use >|< to mark the cursor position (point comment)
    if (before && after) {
        return `${before}>|<${after}`;
    }
    else if (before) {
        return `${before}>|<`;
    }
    else if (after) {
        return `>|<${after}`;
    }
    else {
        return "(empty paragraph)";
    }
}

/**
 * Count occurrences of a string in text
 */
function countOccurrences(needle: string, haystack: string): number {
    if (!needle || needle.length === 0) return 0;
    let count = 0;
    let pos = 0;
    while ((pos = haystack.indexOf(needle, pos)) !== -1) {
        count++;
        pos += 1;
    }
    return count;
}

/**
 * Escape newlines for single-line output
 * Uses ␊ (U+240A) as a visible newline indicator
 */
function escapeNewlines(text: string): string {
    return text.replace(/\r\n/g, "␊").replace(/\n/g, "␊").replace(/\r/g, "␊");
}

/**
 * Format context quote for a change
 */
function formatContextQuote(before: string, after: string): string {
    const parts: string[] = [];

    if (before) {
        parts.push(before);
    }
    if (after) {
        parts.push(after);
    }

    if (parts.length === 0) {
        return "";
    }

    const quote = parts.join(" [...] ");
    return `  # "${quote}"`;
}
