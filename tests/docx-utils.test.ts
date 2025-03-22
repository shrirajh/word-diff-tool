import { describe, it, expect, beforeAll } from "vitest";
import { generateTestSuite } from "./utils/document-generator";
import {
    extractDocumentXml,
    extractContentFromXml,
    extractDocumentStructure,
    extractParagraphs,
    extractRuns,
} from "../src/docx-utils";
import * as fs from "fs";
import * as path from "path";

// Reuse the test files from the processor tests
let testFiles: string[] = [];
let docXml: string;

describe("DOCX Utils Tests", () => {
    // Setup: generate test documents and extract XML before running tests
    beforeAll(async () => {
        testFiles = await generateTestSuite();
        expect(testFiles.length).toBeGreaterThan(0);

        // Extract document XML from one of the files for testing
        const complexDocPath = path.resolve(process.cwd(), "tests/fixtures/complex.docx");
        docXml = await extractDocumentXml(complexDocPath);
        expect(docXml).toBeTruthy();
        expect(docXml.length).toBeGreaterThan(0);
    });

    it("should extract document XML from a DOCX file", async () => {
        const simpleDocPath = path.resolve(process.cwd(), "tests/fixtures/simple.docx");
        expect(fs.existsSync(simpleDocPath)).toBe(true);

        const xml = await extractDocumentXml(simpleDocPath);
        expect(xml).toBeTruthy();
        expect(xml.length).toBeGreaterThan(0);
        expect(xml).toContain("<w:document");
        expect(xml).toContain("</w:document>");
        expect(xml).toContain("<w:body");
        expect(xml).toContain("</w:body>");
    });

    it("should extract content from XML", () => {
    // Create a sample XML snippet with text content
        const sampleXml = `<w:p>
      <w:r>
        <w:t>This is some text content</w:t>
      </w:r>
      <w:r>
        <w:t>with multiple runs</w:t>
      </w:r>
    </w:p>`;

        const content = extractContentFromXml(sampleXml);
        expect(content).toBe("This is some text content with multiple runs");
    });

    it("should extract document structure", () => {
    // We'll use the XML from the beforeAll hook
        const structure = extractDocumentStructure(docXml);

        expect(structure).toBeDefined();
        expect(structure.paragraphs).toBeDefined();
        expect(structure.paragraphs.length).toBeGreaterThan(0);
        expect(structure.fullText).toBeDefined();
        expect(structure.fullText.length).toBeGreaterThan(0);

        // Each paragraph should have the expected properties
        for (const paragraph of structure.paragraphs) {
            expect(paragraph).toHaveProperty("text");
            expect(paragraph).toHaveProperty("index");
            expect(paragraph).toHaveProperty("xml");
            expect(paragraph).toHaveProperty("runs");
            expect(Array.isArray(paragraph.runs)).toBe(true);

            // Each run should have the expected properties
            for (const run of paragraph.runs) {
                expect(run).toHaveProperty("text");
                expect(run).toHaveProperty("index");
                expect(run).toHaveProperty("xml");
            }
        }
    });

    it("should extract paragraphs from XML", () => {
    // We'll use the XML from the beforeAll hook
        const paragraphs = extractParagraphs(docXml);

        expect(paragraphs).toBeDefined();
        expect(paragraphs.length).toBeGreaterThan(0);

        // Each paragraph should have the expected properties
        for (const paragraph of paragraphs) {
            expect(paragraph).toHaveProperty("text");
            expect(paragraph).toHaveProperty("index");
        }
    });

    it("should extract runs from XML", () => {
    // We'll use the XML from the beforeAll hook
        const runs = extractRuns(docXml);

        expect(runs).toBeDefined();
        expect(runs.length).toBeGreaterThan(0);

        // Each run should have the expected properties
        for (const run of runs) {
            expect(run).toHaveProperty("text");
            expect(run).toHaveProperty("index");
        }
    });

    it("should handle XML with different document structures", async () => {
    // Test with different document types to ensure robustness
        const testDocPaths = [
            path.resolve(process.cwd(), "tests/fixtures/simple.docx"),
            path.resolve(process.cwd(), "tests/fixtures/insertions-only.docx"),
            path.resolve(process.cwd(), "tests/fixtures/deletions-only.docx"),
        ];

        for (const docPath of testDocPaths) {
            const xml = await extractDocumentXml(docPath);

            // Test each function with this XML
            const structure = extractDocumentStructure(xml);
            expect(structure.paragraphs.length).toBeGreaterThan(0);

            const paragraphs = extractParagraphs(xml);
            expect(paragraphs.length).toBeGreaterThan(0);

            const runs = extractRuns(xml);
            expect(runs.length).toBeGreaterThan(0);
        }
    });
});
