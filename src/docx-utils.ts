import * as fs from "fs";
import * as JSZip from "jszip";

/**
 * Document structure for better tracking of content and positions
 */
export interface DocumentStructure {
    paragraphs: {
        text: string;
        index: number;
        xml: string;
        runs: {
            text: string;
            index: number;
            xml: string;
        }[];
    }[];
    fullText: string;
}

/**
 * Represents a comment extracted from a Word document
 */
export interface WordComment {
    id: string;
    author: string;
    date: string;
    text: string;
    // The text that the comment is attached to (between commentRangeStart and commentRangeEnd)
    anchoredText: string;
    // Context before the anchored text (for uniqueness)
    contextBefore: string;
    // Context after the anchored text (for uniqueness)
    contextAfter: string;
    // Paragraph number (1-indexed) where the comment starts
    paragraphNumber: number;
}

/**
 * Extracts and returns the contents of the document.xml file from a .docx file
 */
export async function extractDocumentXml(docxPath: string): Promise<string> {
    try {
        const fileBuffer = fs.readFileSync(docxPath);
        const zip = await JSZip.loadAsync(fileBuffer);

        // Get the document.xml file from the zip
        const documentXmlFile = zip.file("word/document.xml");
        if (!documentXmlFile) {
            throw new Error("document.xml not found in the .docx file");
        }

        // Get the content of document.xml
        const documentXml = await documentXmlFile.async("string");
        return documentXml;
    }
    catch (error) {
        console.error("Error extracting document.xml:", error);
        throw error;
    }
}

/**
 * Extract content from each XML node based on type
 */
export function extractContentFromXml(xml: string): string {
    // Remove all XML tags but keep their text content
    const content = xml.replace(/<[^>]*>/g, " ").trim();

    // Remove extra spaces
    return content.replace(/\s+/g, " ");
}

/**
 * Parse XML to extract document structure including paragraphs, runs, and their content
 */
export function extractDocumentStructure(xml: string): DocumentStructure {
    const structure: DocumentStructure = {
        paragraphs: [],
        fullText: "",
    };

    let currentTextIndex = 0;

    // Find all paragraph elements using matchAll to avoid regex state issues
    const paragraphMatches = xml.matchAll(/<w:p\b[^>]*>(.*?)<\/w:p>/gs);

    for (const paragraphMatch of paragraphMatches) {
        const paragraphXml = paragraphMatch[0];
        const paragraphContentXml = paragraphMatch[1];

        const paragraphStartIndex = currentTextIndex;
        let paragraphText = "";

        // Extract text runs from the paragraph
        const runs: {
            text: string;
            index: number;
            xml: string;
        }[] = [];
        const runMatches = paragraphContentXml.matchAll(/<w:r\b[^>]*>(.*?)<\/w:r>/gs);

        for (const runMatch of runMatches) {
            const runXml = runMatch[0];
            const runContentXml = runMatch[1];

            let runText = "";
            const textMatches = runContentXml.matchAll(/<w:t\b[^>]*>(.*?)<\/w:t>/gs);

            for (const textMatch of textMatches) {
                runText += textMatch[1];
            }

            if (runText) {
                runs.push({
                    text: runText,
                    index: currentTextIndex,
                    xml: runXml,
                });

                paragraphText += runText;
                currentTextIndex += runText.length;
            }
        }

        // Store the paragraph info
        structure.paragraphs.push({
            text: paragraphText,
            index: paragraphStartIndex,
            xml: paragraphXml,
            runs,
        });

        // Add a newline after each paragraph in the full text
        structure.fullText += paragraphText + "\n";
        currentTextIndex += 1; // For the newline
    }

    return structure;
}

/**
 * Parse XML to extract paragraphs and their content
 */
export function extractParagraphs(xml: string): {
    text: string;
    index: number;
}[] {
    const paragraphs: {
        text: string;
        index: number;
    }[] = [];
    let currentIndex = 0;

    // Find all paragraph elements using matchAll to avoid regex state issues
    const paragraphMatches = xml.matchAll(/<w:p\b[^>]*>(.*?)<\/w:p>/gs);

    for (const match of paragraphMatches) {
        const paragraphXml = match[1];
        let paragraphText = "";

        // Extract text from the paragraph
        const textMatches = paragraphXml.matchAll(/<w:t\b[^>]*>(.*?)<\/w:t>/gs);
        for (const textMatch of textMatches) {
            paragraphText += textMatch[1];
        }

        // Store the paragraph text and its index in the plain text content
        paragraphs.push({
            text: paragraphText,
            index: currentIndex,
        });

        currentIndex += paragraphText.length + 1; // +1 for the newline
    }

    return paragraphs;
}

/**
 * Extract all runs (text elements) from the document XML
 */
export function extractRuns(xml: string): {
    text: string;
    index: number;
}[] {
    const runs: {
        text: string;
        index: number;
    }[] = [];
    let currentIndex = 0;

    // Find all text runs using matchAll to avoid regex state issues
    const runMatches = xml.matchAll(/<w:r\b[^>]*>(.*?)<\/w:r>/gs);

    for (const match of runMatches) {
        const runXml = match[1];
        let runText = "";

        // Extract text from the run
        const textMatches = runXml.matchAll(/<w:t\b[^>]*>(.*?)<\/w:t>/gs);
        for (const textMatch of textMatches) {
            runText += textMatch[1];
        }

        // Store the run text and its index in the plain text content
        if (runText) {
            runs.push({
                text: runText,
                index: currentIndex,
            });

            currentIndex += runText.length;
        }
    }

    return runs;
}

/**
 * Decode XML entities in a string
 */
export function decodeXmlEntities(text: string): string {
    return text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ");
}

/**
 * Extract comments from a Word document
 * Comments are stored in word/comments.xml and referenced in word/document.xml
 * via commentRangeStart, commentRangeEnd, and commentReference elements
 */
export async function extractComments(docxPath: string): Promise<WordComment[]> {
    const fileBuffer = fs.readFileSync(docxPath);
    const zip = await JSZip.loadAsync(fileBuffer);

    // Get comments.xml
    const commentsXmlFile = zip.file("word/comments.xml");
    if (!commentsXmlFile) {
        // No comments in this document
        return [];
    }

    const commentsXml = await commentsXmlFile.async("string");

    // Get document.xml to find comment ranges and paragraph numbers
    const documentXmlFile = zip.file("word/document.xml");
    if (!documentXmlFile) {
        throw new Error("document.xml not found in the .docx file");
    }
    const documentXml = await documentXmlFile.async("string");

    // Parse comments from comments.xml
    const commentMap = parseCommentsXml(commentsXml);

    // Find comment ranges and anchored text from document.xml
    const commentRanges = parseCommentRanges(documentXml);

    // Merge comment content with range information
    const comments: WordComment[] = [];
    for (const [id, comment] of commentMap.entries()) {
        const range = commentRanges.get(id);
        comments.push({
            id,
            author: comment.author,
            date: comment.date,
            text: comment.text,
            anchoredText: range?.anchoredText || "",
            contextBefore: range?.contextBefore || "",
            contextAfter: range?.contextAfter || "",
            paragraphNumber: range?.paragraphNumber || 0,
        });
    }

    // Sort by paragraph number
    comments.sort((a, b) => a.paragraphNumber - b.paragraphNumber);

    return comments;
}

/**
 * Parse the comments.xml file to extract comment content
 */
function parseCommentsXml(xml: string): Map<string, { author: string; date: string; text: string }> {
    const commentMap = new Map<string, { author: string; date: string; text: string }>();

    // Find all w:comment elements
    const commentRegex = /<w:comment\s+[^>]*w:id="([^"]+)"[^>]*w:author="([^"]*)"[^>]*w:date="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g;
    // Also handle different attribute orders
    const commentRegexAlt = /<w:comment\s+[^>]*w:author="([^"]*)"[^>]*w:id="([^"]+)"[^>]*w:date="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g;

    let match;
    while ((match = commentRegex.exec(xml)) !== null) {
        const id = match[1];
        const author = decodeXmlEntities(match[2]);
        const date = match[3];
        const content = match[4];

        // Extract text from the comment content
        const text = extractTextFromXmlContent(content);

        commentMap.set(id, { author, date, text });
    }

    // Try alternate attribute order if no matches found
    if (commentMap.size === 0) {
        while ((match = commentRegexAlt.exec(xml)) !== null) {
            const author = decodeXmlEntities(match[1]);
            const id = match[2];
            const date = match[3];
            const content = match[4];

            const text = extractTextFromXmlContent(content);

            commentMap.set(id, { author, date, text });
        }
    }

    // If still no matches, try a more flexible approach
    if (commentMap.size === 0) {
        const flexibleRegex = /<w:comment\s+([^>]*)>([\s\S]*?)<\/w:comment>/g;
        while ((match = flexibleRegex.exec(xml)) !== null) {
            const attrs = match[1];
            const content = match[2];

            const idMatch = /w:id="([^"]+)"/.exec(attrs);
            const authorMatch = /w:author="([^"]*)"/.exec(attrs);
            const dateMatch = /w:date="([^"]*)"/.exec(attrs);

            if (idMatch) {
                const id = idMatch[1];
                const author = authorMatch ? decodeXmlEntities(authorMatch[1]) : "Unknown";
                const date = dateMatch ? dateMatch[1] : "";
                const text = extractTextFromXmlContent(content);

                commentMap.set(id, { author, date, text });
            }
        }
    }

    return commentMap;
}

/**
 * Extract text content from XML, removing all tags
 */
function extractTextFromXmlContent(xml: string): string {
    let text = "";

    // Extract text from w:t elements
    const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let match;
    while ((match = textRegex.exec(xml)) !== null) {
        text += decodeXmlEntities(match[1]);
    }

    return text.trim();
}

/**
 * Parse document.xml to find comment ranges (start/end) and the anchored text with context
 */
function parseCommentRanges(documentXml: string): Map<string, { anchoredText: string; contextBefore: string; contextAfter: string; paragraphNumber: number }> {
    const rangeMap = new Map<string, { anchoredText: string; contextBefore: string; contextAfter: string; paragraphNumber: number }>();

    // First, find all paragraphs and their positions and content
    const paragraphs: { start: number; end: number; content: string }[] = [];
    let paragraphMatch;
    const paragraphRegex = /<w:p\b[^>]*>/g;

    while ((paragraphMatch = paragraphRegex.exec(documentXml)) !== null) {
        const start = paragraphMatch.index;
        // Find the closing tag
        const endTagIndex = documentXml.indexOf("</w:p>", start);
        if (endTagIndex !== -1) {
            const content = documentXml.substring(start, endTagIndex + 6);
            paragraphs.push({ start, end: endTagIndex + 6, content });
        }
    }

    // Find all commentRangeStart elements
    const startRegex = /<w:commentRangeStart\s+w:id="([^"]+)"\s*\/>/g;
    let startMatch;

    while ((startMatch = startRegex.exec(documentXml)) !== null) {
        const id = startMatch[1];
        const startPos = startMatch.index;

        // Find the corresponding commentRangeEnd
        const endRegex = new RegExp(`<w:commentRangeEnd\\s+w:id="${id}"\\s*/>`, "g");
        endRegex.lastIndex = startPos;
        const endMatch = endRegex.exec(documentXml);

        let anchoredText = "";
        let contextBefore = "";
        let contextAfter = "";

        // Find which paragraph this comment is in
        let paragraphNumber = 0;
        let containingParagraph: { start: number; end: number; content: string } | null = null;

        for (let i = 0; i < paragraphs.length; i++) {
            if (startPos >= paragraphs[i].start && startPos <= paragraphs[i].end) {
                paragraphNumber = i + 1; // 1-indexed
                containingParagraph = paragraphs[i];
                break;
            }
        }

        if (endMatch) {
            // Extract text between start and end (the anchored/selected text)
            const rangeContent = documentXml.substring(startPos, endMatch.index);
            anchoredText = extractTextFromXmlContent(rangeContent);

            // Extract context before (from start of paragraph to commentRangeStart)
            if (containingParagraph) {
                const beforeContent = documentXml.substring(containingParagraph.start, startPos);
                contextBefore = extractTextFromXmlContent(beforeContent);

                // Extract context after (from commentRangeEnd to end of paragraph)
                const afterContent = documentXml.substring(endMatch.index, containingParagraph.end);
                contextAfter = extractTextFromXmlContent(afterContent);
            }
        }

        rangeMap.set(id, { anchoredText, contextBefore, contextAfter, paragraphNumber });
    }

    return rangeMap;
}
