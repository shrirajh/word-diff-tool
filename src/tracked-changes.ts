import fs from "fs";
import { extractDocumentXml, extractRuns, extractDocumentStructure } from "./docx-utils";

/**
 * Represents a tracked change in a document
 */
export interface TrackedChange {
    type: "insertion" | "deletion";
    author: string;
    date: Date;
    text: string;
    position: number;
    paragraphIndex?: number; // Index of the paragraph containing this change
    surroundingContext?: {
        before: string;
        after: string;
    };
}

/**
 * Extract tracked changes from a Word document
 *
 * @param docxBuffer Buffer containing the Word document
 * @returns Array of tracked changes
 */
export async function extractTrackedChanges(docxBuffer: Buffer): Promise<TrackedChange[]> {
    try {
    // Create a temporary file to process
        const tempFilePath = "/tmp/temp-docx-file.docx";
        fs.writeFileSync(tempFilePath, docxBuffer);

        // Extract document XML
        const docXml = await extractDocumentXml(tempFilePath);

        // Clean up temporary file
        fs.unlinkSync(tempFilePath);

        // Extract changes from document.xml
        const trackedChanges: TrackedChange[] = [];

        // Extract document structure
        const structure = extractDocumentStructure(docXml);

        // Also get runs for compatibility with the rest of the code
        const runs = extractRuns(docXml);

        console.log(`Extracted document structure with ${structure.paragraphs.length} paragraphs and ${runs.length} runs`);

        // Find insertions (w:ins elements)
        const insertions = findAllMatches(/<w:ins\s+[^>]*>(.*?)<\/w:ins>/gs, docXml);
        console.log(`Found ${insertions.length} insertion elements in the document XML`);

        for (const match of insertions) {
            const authorMatch = /w:author="([^"]+)"/.exec(match[0]);
            const dateMatch = /w:date="([^"]+)"/.exec(match[0]);

            // Extract all text within the insertion
            let insertedText = "";
            const textMatches = findAllMatches(/<w:t\b[^>]*>(.*?)<\/w:t>/gs, match[1]);
            for (const textMatch of textMatches) {
                insertedText += decodeXmlEntities(textMatch[1]);
            }

            if (insertedText) {
                // Find occurrence in document structure and get context
                const contextInfo = findChangeContext(match[0], docXml, structure);
                const position = contextInfo.position;

                trackedChanges.push({
                    type: "insertion",
                    author: authorMatch ? authorMatch[1] : "Unknown",
                    date: dateMatch ? new Date(dateMatch[1]) : new Date(),
                    text: insertedText,
                    position,
                    paragraphIndex: contextInfo.paragraphIndex,
                    surroundingContext: contextInfo.surroundingContext,
                });
            }
        }

        // Find deletions (w:del elements)
        const deletions = findAllMatches(/<w:del\s+[^>]*>(.*?)<\/w:del>/gs, docXml);
        console.log(`Found ${deletions.length} deletion elements in the document XML`);

        for (const match of deletions) {
            const authorMatch = /w:author="([^"]+)"/.exec(match[0]);
            const dateMatch = /w:date="([^"]+)"/.exec(match[0]);

            // Extract all deleted text
            let deletedText = "";
            // Look for both standard delText elements and regular text within deletions
            const delTextMatches = findAllMatches(/<w:delText\b[^>]*>(.*?)<\/w:delText>/gs, match[1]);
            if (delTextMatches.length > 0) {
                for (const textMatch of delTextMatches) {
                    deletedText += decodeXmlEntities(textMatch[1]);
                }
            } else {
                // Try to find regular text elements within deletion
                const regularTextMatches = findAllMatches(/<w:t\b[^>]*>(.*?)<\/w:t>/gs, match[1]);
                for (const textMatch of regularTextMatches) {
                    deletedText += decodeXmlEntities(textMatch[1]);
                }
            }

            if (deletedText) {
                // Find occurrence in document structure and get context
                const contextInfo = findChangeContext(match[0], docXml, structure);
                const position = contextInfo.position;

                trackedChanges.push({
                    type: "deletion",
                    author: authorMatch ? authorMatch[1] : "Unknown",
                    date: dateMatch ? new Date(dateMatch[1]) : new Date(),
                    text: deletedText,
                    position,
                    paragraphIndex: contextInfo.paragraphIndex,
                    surroundingContext: contextInfo.surroundingContext,
                });
            }
        }

        return trackedChanges;
    }
    catch (error) {
        console.error("Error extracting tracked changes:", error);
        return [];
    }
}

/**
 * Find the context (position, paragraph, surrounding text) for a tracked change
 */
function findChangeContext(
    changeXml: string,
    docXml: string,
    structure: {
        paragraphs: {
            text: string;
            index: number;
            xml: string;
            runs: any[];
        }[];
        fullText: string;
    },
): {
        position: number;
        paragraphIndex: number;
        surroundingContext: {
            before: string;
            after: string;
        };
    } {
    // Find the index of the change element in the XML
    const index = docXml.indexOf(changeXml);
    if (index === -1) {
        return {
            position: 0,
            paragraphIndex: 0,
            surroundingContext: {
                before: "",
                after: "",
            },
        };
    }

    // Find the paragraph containing or closest to this change
    let paragraphIndex = -1;
    let position = 0;
    let before = "";
    let after = "";

    for (let i = 0; i < structure.paragraphs.length; i++) {
        const paragraph = structure.paragraphs[i];
        const paragraphEndIndex = docXml.indexOf("</w:p>", docXml.indexOf(paragraph.xml)) + 6;

        // Check if the change is within this paragraph
        if (index > docXml.indexOf(paragraph.xml) && index < paragraphEndIndex) {
            paragraphIndex = i;
            position = paragraph.index;

            // For context, get surrounding text (before and after the change)
            if (i > 0) {
                before = structure.paragraphs[i - 1].text;
            }

            if (i < structure.paragraphs.length - 1) {
                after = structure.paragraphs[i + 1].text;
            }

            // Refine position by checking the runs
            for (const run of paragraph.runs) {
                const runIndex = docXml.indexOf(run.xml);
                if (runIndex < index) {
                    position += run.text.length;
                }
            }

            break;
        }
    }

    // If we couldn't find the exact paragraph, use the closest one
    if (paragraphIndex === -1) {
        let closestDistance = Infinity;

        for (let i = 0; i < structure.paragraphs.length; i++) {
            const paragraph = structure.paragraphs[i];
            const paragraphXmlIndex = docXml.indexOf(paragraph.xml);
            const distance = Math.abs(index - paragraphXmlIndex);

            if (distance < closestDistance) {
                closestDistance = distance;
                position = paragraph.index;
                paragraphIndex = i;

                if (i > 0) {
                    before = structure.paragraphs[i - 1].text;
                }

                if (i < structure.paragraphs.length - 1) {
                    after = structure.paragraphs[i + 1].text;
                }
            }
        }
    }

    return {
        position,
        paragraphIndex,
        surroundingContext: {
            before,
            after,
        },
    };
}

/**
 * Find all matches for a regex pattern in a string
 */
function findAllMatches(pattern: RegExp, text: string): RegExpExecArray[] {
    const matches: RegExpExecArray[] = [];
    let match;

    // Reset the regex to start from the beginning
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
        matches.push(match);
    }

    return matches;
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
        .replace(/&amp;/g, "&");
}
