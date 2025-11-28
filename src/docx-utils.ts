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
