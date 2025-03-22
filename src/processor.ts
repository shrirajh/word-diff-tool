import fs from "fs";
import * as JSZip from "jszip";
import path from "path";

/**
 * Process a Word document with tracked changes and convert to markdown with inline diffs
 *
 * @param filePath Path to the Word document
 * @param useHighlights Whether to treat highlighted text as additions/deletions
 * @returns Markdown string with inline diffs
 */
export async function processDocxWithTrackedChanges(filePath: string, useHighlights = false): Promise<string> {
    try {
        console.log("Reading document file...");
        const buffer = fs.readFileSync(filePath);
        console.log("Extracting document content with tracked changes...");

        // Extract the document XML from the .docx file
        const zip = await JSZip.loadAsync(buffer);
        const documentXml = await zip.file("word/document.xml")?.async("string");

        if (!documentXml) {
            throw new Error("Could not extract document.xml from the Word document");
        }

        console.log("Converting to markdown with tracked changes...");
        // Convert the document content to markdown with tracked changes
        const markdown = convertDocxXmlToMarkdown(documentXml, useHighlights, filePath);

        return markdown;
    }
    catch (error) {
        console.error("Error processing document:", error);
        throw error;
    }
}

/**
 * Directly convert Word document XML to markdown with tracked changes
 */
function convertDocxXmlToMarkdown(xml: string, useHighlights = false, filePath = "document.docx"): string {
    console.log(`Document XML size: ${xml.length} characters`);

    // Extract each paragraph from the document
    const paragraphs = useHighlights
        ? extractParagraphsWithHighlights(xml)
        : extractParagraphs(xml);

    console.log(`Extracted ${paragraphs.length} paragraphs`);

    // Combine paragraphs into markdown, using filename as title
    let markdown = `# ${path.basename(filePath, ".docx")}\n\n`;

    for (const paragraph of paragraphs) {
        markdown += paragraph + "\n\n";
    }

    // Clean up excessive newlines
    markdown = markdown.replace(/\n{3,}/g, "\n\n");

    console.log(`Final markdown size: ${markdown.length} characters`);

    return markdown;
}

/**
 * Extract paragraphs from document XML, preserving tracked changes
 */
function extractParagraphs(xml: string): string[] {
    const paragraphs: string[] = [];
    let paragraphCount = 0;

    try {
    // More reliable way to extract paragraphs - find each paragraph tag
        let currentPos = 0;
        let startTagPos = xml.indexOf("<w:p", currentPos);

        while (startTagPos !== -1) {
            // Find the end of this paragraph
            const endTagPos = xml.indexOf("</w:p>", startTagPos);
            if (endTagPos === -1) break; // No closing tag found

            paragraphCount++;
            if (paragraphCount % 20 === 0) {
                console.log(`Processing paragraph ${paragraphCount}...`);
            }

            // Extract the paragraph content (excluding the tags)
            const paragraphContent = xml.substring(
                xml.indexOf(">", startTagPos) + 1,
                endTagPos,
            );

            try {
                // Process the paragraph content
                const processedParagraph = processParagraphContent(paragraphContent);

                // Skip empty paragraphs
                if (processedParagraph.trim()) {
                    paragraphs.push(processedParagraph);
                }
            }
            catch (error) {
                console.error(`Error processing paragraph ${paragraphCount}: ${error}`);
                // Add a placeholder for the failed paragraph to preserve document structure
                paragraphs.push(`[Error processing paragraph ${paragraphCount}]`);
            }

            // Move to the next paragraph
            currentPos = endTagPos + 6;
            startTagPos = xml.indexOf("<w:p", currentPos);
        }

        console.log(`Total paragraphs found: ${paragraphCount}`);
    }
    catch (error) {
        console.error("Error extracting paragraphs:", error);
    }

    return paragraphs;
}

/**
 * Process paragraph content, including tracked changes
 */
function processParagraphContent(paragraphXml: string): string {
    // Build paragraph content piece by piece, preserving tracked changes
    const parts: {
        type: "text" | "ins" | "del";
        content: string;
    }[] = [];
    let currentPosition = 0;

    // Process each section of the paragraph
    while (currentPosition < paragraphXml.length) {
    // Check for insertions first
        const insStartIndex = paragraphXml.indexOf("<w:ins", currentPosition);

        // Check for deletions
        const delStartIndex = paragraphXml.indexOf("<w:del", currentPosition);

        // Check for regular runs
        const runStartIndex = paragraphXml.indexOf("<w:r", currentPosition);

        // If we can't find any more elements, break
        if (insStartIndex === -1 && delStartIndex === -1 && runStartIndex === -1) {
            break;
        }

        // Determine which element comes first
        if (insStartIndex !== -1 && (insStartIndex < delStartIndex || delStartIndex === -1)
            && (insStartIndex < runStartIndex || runStartIndex === -1)) {
            // Process insertion
            const insEndIndex = paragraphXml.indexOf("</w:ins>", insStartIndex);

            if (insEndIndex === -1) {
                // Malformed XML - move to next character to avoid infinite loop
                currentPosition = insStartIndex + 1;
                continue;
            }

            const insContent = paragraphXml.substring(insStartIndex, insEndIndex + 7);
            const insertedText = extractTextFromElement(insContent, "ins");

            if (insertedText) {
                parts.push({
                    type: "ins",
                    content: insertedText,
                });
            }

            currentPosition = insEndIndex + 7;
        }
        else if (delStartIndex !== -1 && (delStartIndex < runStartIndex || runStartIndex === -1)) {
            // Process deletion
            const delEndIndex = paragraphXml.indexOf("</w:del>", delStartIndex);

            if (delEndIndex === -1) {
                // Malformed XML - move to next character to avoid infinite loop
                currentPosition = delStartIndex + 1;
                continue;
            }

            const delContent = paragraphXml.substring(delStartIndex, delEndIndex + 7);
            const deletedText = extractTextFromElement(delContent, "del");

            if (deletedText) {
                parts.push({
                    type: "del",
                    content: deletedText,
                });
            }

            currentPosition = delEndIndex + 7;
        }
        else if (runStartIndex !== -1) {
            // Process regular run
            const runEndIndex = paragraphXml.indexOf("</w:r>", runStartIndex);

            if (runEndIndex === -1) {
                // Malformed XML - move to next character to avoid infinite loop
                currentPosition = runStartIndex + 1;
                continue;
            }

            const runContent = paragraphXml.substring(runStartIndex, runEndIndex + 6);

            // Skip runs inside insertions or deletions
            const previousXml = paragraphXml.substring(0, runStartIndex);
            const insOpenCount = (previousXml.match(/<w:ins\b/g) || []).length;
            const insCloseCount = (previousXml.match(/<\/w:ins>/g) || []).length;
            const delOpenCount = (previousXml.match(/<w:del\b/g) || []).length;
            const delCloseCount = (previousXml.match(/<\/w:del>/g) || []).length;

            const insideIns = insOpenCount > insCloseCount;
            const insideDel = delOpenCount > delCloseCount;

            if (!insideIns && !insideDel) {
                const textContent = extractTextFromRun(runContent);
                if (textContent) {
                    parts.push({
                        type: "text",
                        content: textContent,
                    });
                }
            }

            currentPosition = runEndIndex + 6;
        }
        else {
            // Shouldn't get here, but just in case, move forward to avoid infinite loop
            currentPosition++;
        }
    }

    // Convert paragraph parts to markdown with tracked changes
    return convertParagraphPartsToMarkdown(parts);
}

/**
 * Extract text from an insertion or deletion element
 */
function extractTextFromElement(elementXml: string, elementType: "ins" | "del"): string {
    let text = "";

    // For deletions, first try with delText, if not found, fallback to regular text
    if (elementType === "del") {
        const delTextRegex = /<w:delText\b[^>]*>(.*?)<\/w:delText>/gs;
        let match;
        let hasMatches = false;

        while ((match = delTextRegex.exec(elementXml)) !== null) {
            text += decodeXmlEntities(match[1]);
            hasMatches = true;
        }

        // If no delText elements found, try with regular text elements
        if (!hasMatches) {
            const regularTextRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
            while ((match = regularTextRegex.exec(elementXml)) !== null) {
                text += decodeXmlEntities(match[1]);
            }
        }
    }
    else {
        // For insertions, use regular text elements
        const regex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
        let match;
        while ((match = regex.exec(elementXml)) !== null) {
            text += decodeXmlEntities(match[1]);
        }
    }

    return text;
}

/**
 * Extract text from a run element
 */
function extractTextFromRun(runXml: string): string {
    let text = "";
    const regex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;

    let match;
    while ((match = regex.exec(runXml)) !== null) {
        text += decodeXmlEntities(match[1]);
    }

    return text;
}

/**
 * Merge adjacent diffs of the same type
 */
function mergeAdjacentDiffs(parts: {
    type: "text" | "ins" | "del";
    content: string;
}[]): {
    type: "text" | "ins" | "del";
    content: string;
}[] {
    if (parts.length <= 1) {
        return parts;
    }

    const mergedParts: {
        type: "text" | "ins" | "del";
        content: string;
    }[] = [];

    let currentPart = parts[0];

    for (let i = 1; i < parts.length; i++) {
        const nextPart = parts[i];
        
        // If both parts are the same type (ins or del), merge them
        if (currentPart.type !== "text" && nextPart.type === currentPart.type) {
            currentPart.content += nextPart.content;
        } else {
            // Push the current part and move to the next
            mergedParts.push(currentPart);
            currentPart = nextPart;
        }
    }
    
    // Push the last part
    mergedParts.push(currentPart);

    return mergedParts;
}

/**
 * Convert paragraph parts to markdown with tracked changes
 */
function convertParagraphPartsToMarkdown(parts: {
    type: "text" | "ins" | "del";
    content: string;
}[]): string {
    // First merge adjacent diffs of the same type
    const mergedParts = mergeAdjacentDiffs(parts);
    
    // Combine parts with appropriate markdown and tracked change markers
    let markdown = "";

    for (const part of mergedParts) {
        if (part.type === "text") {
            markdown += part.content;
        }
        else if (part.type === "ins") {
            markdown += `{++${part.content}++}`;
        }
        else if (part.type === "del") {
            markdown += `{--${part.content}--}`;
        }
    }

    // Apply markdown formatting
    markdown = formatParagraphAsMarkdown(markdown);

    return markdown;
}

/**
 * Format a paragraph as markdown
 */
function formatParagraphAsMarkdown(text: string): string {
    // Simple heuristics for converting to markdown

    // Check if it's a heading (all caps)
    if (text.toUpperCase() === text && text.length < 100 && text.trim().length > 0) {
    // Don't convert if it already has markdown heading syntax
        if (!text.startsWith("#")) {
            return `## ${text}`;
        }
    }

    // Format links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, match => match); // Preserve existing markdown links
    text = text.replace(/(\b(?:https?|ftp):\/\/[^\s]+\b)/g, (url) => {
    // Don't convert URLs that are already part of a markdown link
        if (text.includes(`[`) && text.includes(`](${url})`)) {
            return url;
        }
        return `<${url}>`;
    });

    // Format email addresses
    text = text.replace(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, (email) => {
    // Don't convert emails that are already part of a markdown link
        if (text.includes(`[`) && text.includes(`](mailto:${email})`)) {
            return email;
        }
        return `<${email}>`;
    });

    // Format bold text (Already bold with ** will be preserved)
    text = text.replace(/(?<!\*)\b[A-Z][A-Z0-9\s]{2,}[A-Z0-9]\b(?!\*)/g, (match) => {
    // Skip already formatted text
        if (match.startsWith("**") && match.endsWith("**")) {
            return match;
        }
        return `**${match}**`;
    });

    return text;
}

/**
 * Extract paragraphs from document XML, also treating highlighted text as tracked changes
 */
function extractParagraphsWithHighlights(xml: string): string[] {
    const paragraphs: string[] = [];
    let paragraphCount = 0;

    try {
        // Process each paragraph
        let currentPos = 0;
        let startTagPos = xml.indexOf("<w:p", currentPos);

        while (startTagPos !== -1) {
            // Find the end of this paragraph
            const endTagPos = xml.indexOf("</w:p>", startTagPos);
            if (endTagPos === -1) break; // No closing tag found

            paragraphCount++;
            if (paragraphCount % 20 === 0) {
                console.log(`Processing paragraph ${paragraphCount}...`);
            }

            // Extract the paragraph content (excluding the tags)
            const paragraphContent = xml.substring(
                xml.indexOf(">", startTagPos) + 1,
                endTagPos,
            );

            try {
                // Process the paragraph content with highlights
                const processedParagraph = processParagraphContentWithHighlights(paragraphContent);

                // Skip empty paragraphs
                if (processedParagraph.trim()) {
                    paragraphs.push(processedParagraph);
                }
            }
            catch (error) {
                console.error(`Error processing paragraph ${paragraphCount}: ${error}`);
                // Add a placeholder for the failed paragraph to preserve document structure
                paragraphs.push(`[Error processing paragraph ${paragraphCount}]`);
            }

            // Move to the next paragraph
            currentPos = endTagPos + 6;
            startTagPos = xml.indexOf("<w:p", currentPos);
        }

        console.log(`Total paragraphs found: ${paragraphCount}`);
    }
    catch (error) {
        console.error("Error extracting paragraphs with highlights:", error);
    }

    return paragraphs;
}

/**
 * Process paragraph content, treating highlighted text as tracked changes
 */
function processParagraphContentWithHighlights(paragraphXml: string): string {
    // Build paragraph content piece by piece, preserving tracked changes
    const parts: {
        type: "text" | "ins" | "del";
        content: string;
    }[] = [];
    let currentPosition = 0;

    // Process each section of the paragraph
    while (currentPosition < paragraphXml.length) {
        // Check for regular runs that may contain highlighting
        const runStartIndex = paragraphXml.indexOf("<w:r", currentPosition);

        // Also check for actual tracked changes
        const insStartIndex = paragraphXml.indexOf("<w:ins", currentPosition);
        const delStartIndex = paragraphXml.indexOf("<w:del", currentPosition);

        // If we can't find any more elements, break
        if (runStartIndex === -1 && insStartIndex === -1 && delStartIndex === -1) {
            break;
        }

        // Determine which element comes first
        if (runStartIndex !== -1 && (runStartIndex < insStartIndex || insStartIndex === -1)
            && (runStartIndex < delStartIndex || delStartIndex === -1)) {
            // Process regular run
            const runEndIndex = paragraphXml.indexOf("</w:r>", runStartIndex);

            if (runEndIndex === -1) {
                // Malformed XML - move to next character to avoid infinite loop
                currentPosition = runStartIndex + 1;
                continue;
            }

            const runContent = paragraphXml.substring(runStartIndex, runEndIndex + 6);

            // Skip runs inside insertions or deletions
            const previousXml = paragraphXml.substring(0, runStartIndex);
            const insOpenCount = (previousXml.match(/<w:ins\b/g) || []).length;
            const insCloseCount = (previousXml.match(/<\/w:ins>/g) || []).length;
            const delOpenCount = (previousXml.match(/<w:del\b/g) || []).length;
            const delCloseCount = (previousXml.match(/<\/w:del>/g) || []).length;

            const insideIns = insOpenCount > insCloseCount;
            const insideDel = delOpenCount > delCloseCount;

            if (!insideIns && !insideDel) {
                // Check if this run contains highlighting
                const highlightType = getHighlightType(runContent);
                const textContent = extractTextFromRun(runContent);

                if (textContent) {
                    if (highlightType === "green") {
                        // Green highlight = insertion
                        parts.push({
                            type: "ins",
                            content: textContent,
                        });
                    }
                    else if (highlightType === "red") {
                        // Red highlight = deletion
                        parts.push({
                            type: "del",
                            content: textContent,
                        });
                    }
                    else {
                        // Regular text
                        parts.push({
                            type: "text",
                            content: textContent,
                        });
                    }
                }
            }

            currentPosition = runEndIndex + 6;
        }
        else if (insStartIndex !== -1 && (insStartIndex < delStartIndex || delStartIndex === -1)) {
            // Process insertion
            const insEndIndex = paragraphXml.indexOf("</w:ins>", insStartIndex);

            if (insEndIndex === -1) {
                // Malformed XML - move to next character to avoid infinite loop
                currentPosition = insStartIndex + 1;
                continue;
            }

            const insContent = paragraphXml.substring(insStartIndex, insEndIndex + 7);
            const insertedText = extractTextFromElement(insContent, "ins");

            if (insertedText) {
                parts.push({
                    type: "ins",
                    content: insertedText,
                });
            }

            currentPosition = insEndIndex + 7;
        }
        else if (delStartIndex !== -1) {
            // Process deletion
            const delEndIndex = paragraphXml.indexOf("</w:del>", delStartIndex);

            if (delEndIndex === -1) {
                // Malformed XML - move to next character to avoid infinite loop
                currentPosition = delStartIndex + 1;
                continue;
            }

            const delContent = paragraphXml.substring(delStartIndex, delEndIndex + 7);
            const deletedText = extractTextFromElement(delContent, "del");

            if (deletedText) {
                parts.push({
                    type: "del",
                    content: deletedText,
                });
            }

            currentPosition = delEndIndex + 7;
        }
        else {
            // Shouldn't get here, but just in case, move forward to avoid infinite loop
            currentPosition++;
        }
    }

    // Convert paragraph parts to markdown with tracked changes
    return convertParagraphPartsToMarkdown(parts);
}

/**
 * Get highlight type from run XML (green, red, or none)
 */
function getHighlightType(runXml: string): "green" | "red" | "none" {
    // Check for highlighting in the run properties
    const highlightRegex = /<w:highlight\s+w:val="([^"]+)"/;
    const match = highlightRegex.exec(runXml);

    if (match) {
        const highlightColor = match[1].toLowerCase();
        if (highlightColor === "green") {
            return "green";
        }
        else if (highlightColor === "red") {
            return "red";
        }
    }

    // Check for shading with green or red fill
    const shadingRegex = /<w:shd\s+[^>]*w:fill="([^"]+)"/;
    const shadingMatch = shadingRegex.exec(runXml);

    if (shadingMatch) {
        const fillColor = shadingMatch[1].toLowerCase();
        // Check for green shades (including light green)
        if (fillColor === "00ff00" || fillColor === "92d050" || fillColor === "00b050") {
            return "green";
        }
        // Check for red shades
        else if (fillColor === "ff0000" || fillColor === "ff6666" || fillColor === "ff9999") {
            return "red";
        }
    }

    return "none";
}

/**
 * Decode XML entities in a string
 */
function decodeXmlEntities(text: string): string {
    return text
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&nbsp;/g, " ");
}
