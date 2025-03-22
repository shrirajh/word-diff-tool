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

    // Find all paragraph elements
    const paragraphRegex = /<w:p\b[^>]*>(.*?)<\/w:p>/gs;
    let paragraphMatch;

    while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
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
        const runRegex = /<w:r\b[^>]*>(.*?)<\/w:r>/gs;
        let runMatch;

        while ((runMatch = runRegex.exec(paragraphContentXml)) !== null) {
            const runXml = runMatch[0];
            const runContentXml = runMatch[1];

            let runText = "";
            const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
            let textMatch;

            while ((textMatch = textRegex.exec(runContentXml)) !== null) {
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

    // Find all paragraph elements
    const paragraphRegex = /<w:p\b[^>]*>(.*?)<\/w:p>/gs;
    let match;

    while ((match = paragraphRegex.exec(xml)) !== null) {
        const paragraphXml = match[1];
        const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
        let textMatch;
        let paragraphText = "";

        // Extract text from the paragraph
        while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
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

    // Find all text runs
    const runRegex = /<w:r\b[^>]*>(.*?)<\/w:r>/gs;
    let match;

    while ((match = runRegex.exec(xml)) !== null) {
        const runXml = match[1];
        const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
        let textMatch;
        let runText = "";

        // Extract text from the run
        while ((textMatch = textRegex.exec(runXml)) !== null) {
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
