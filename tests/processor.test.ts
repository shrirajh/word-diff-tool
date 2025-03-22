import { describe, it, expect, beforeAll } from "vitest";
import { generateTestSuite } from "./utils/document-generator";
import { processDocxWithTrackedChanges } from "../src/processor";
import * as fs from "fs";
import * as path from "path";

// Generate test files once before all tests
let testFiles: string[] = [];

describe("DOCX Processor Tests", () => {
    // Setup: generate test documents before running tests
    beforeAll(async () => {
        testFiles = await generateTestSuite();
        expect(testFiles.length).toBeGreaterThan(0);

        // Verify files were created
        for (const file of testFiles) {
            expect(fs.existsSync(file)).toBe(true);
            const stats = fs.statSync(file);
            expect(stats.size).toBeGreaterThan(0);
        }
    });

    it("should process a simple document without tracked changes", async () => {
        const simpleDocPath = path.resolve(process.cwd(), "tests/fixtures/simple.docx");
        expect(fs.existsSync(simpleDocPath)).toBe(true);

        const markdown = await processDocxWithTrackedChanges(simpleDocPath);
        expect(markdown).toContain("# Markdown with tracked changes");
        expect(markdown).toContain("This is a simple document");
        expect(markdown).toContain("It has no tracked changes");
        expect(markdown).toContain("Just regular paragraphs of text");

        // Should not contain any tracked changes markup
        expect(markdown).not.toContain("{++");
        expect(markdown).not.toContain("++}");
        expect(markdown).not.toContain("{--");
        expect(markdown).not.toContain("--}");
    });

    it("should process a document with insertions only", async () => {
        const insertionsDocPath = path.resolve(process.cwd(), "tests/fixtures/insertions-only.docx");
        expect(fs.existsSync(insertionsDocPath)).toBe(true);

        const markdown = await processDocxWithTrackedChanges(insertionsDocPath);
        expect(markdown).toContain("# Markdown with tracked changes");
        expect(markdown).toContain("This is a document with insertions only");

        // Should contain insertion markup
        expect(markdown).toContain("{++");
        expect(markdown).toContain("++}");
        expect(markdown).toContain("{++inserted text++}");
        expect(markdown).toContain("{++another insertion++}");

        // Should not contain deletion markup
        expect(markdown).not.toContain("{--");
        expect(markdown).not.toContain("--}");
    });

    it("should process a document with deletions only", async () => {
        const deletionsDocPath = path.resolve(process.cwd(), "tests/fixtures/deletions-only.docx");
        expect(fs.existsSync(deletionsDocPath)).toBe(true);

        const markdown = await processDocxWithTrackedChanges(deletionsDocPath);
        expect(markdown).toContain("# Markdown with tracked changes");
        expect(markdown).toContain("This is a document with deletions only");

        // Should contain deletion markup
        expect(markdown).toContain("{--");
        expect(markdown).toContain("--}");
        expect(markdown).toContain("{--deleted text--}");
        expect(markdown).toContain("{--another deletion--}");

        // Should not contain insertion markup
        expect(markdown).not.toContain("{++");
        expect(markdown).not.toContain("++}");
    });

    it("should process a document with mixed tracked changes", async () => {
        const mixedDocPath = path.resolve(process.cwd(), "tests/fixtures/mixed-changes.docx");
        expect(fs.existsSync(mixedDocPath)).toBe(true);

        const markdown = await processDocxWithTrackedChanges(mixedDocPath);
        expect(markdown).toContain("# Markdown with tracked changes");
        expect(markdown).toContain("This is a document with mixed tracked changes");

        // Should contain both insertion and deletion markup
        expect(markdown).toContain("{++important insertion++}");
        expect(markdown).toContain("{--unnecessary text--}");
    });

    it("should process a complex document with multiple changes", async () => {
        const complexDocPath = path.resolve(process.cwd(), "tests/fixtures/complex.docx");
        expect(fs.existsSync(complexDocPath)).toBe(true);

        const markdown = await processDocxWithTrackedChanges(complexDocPath);
        expect(markdown).toContain("# Markdown with tracked changes");
        expect(markdown).toContain("This is a complex document with multiple paragraphs");

        // Should contain multiple tracked changes
        expect(markdown).toContain("{++complex insertion++}");
        expect(markdown).toContain("{++another complex insertion++}");
        expect(markdown).toContain("{--complex deletion--}");
        expect(markdown).toContain("{--another complex deletion--}");
    });
});
