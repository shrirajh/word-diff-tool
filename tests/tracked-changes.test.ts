import { describe, it, expect, beforeAll } from "vitest";
import { generateTestSuite } from "./utils/document-generator";
import { extractTrackedChanges } from "../src/tracked-changes";
import * as fs from "fs";
import * as path from "path";

// Reuse the test files from the processor tests
let testFiles: string[] = [];

describe("Tracked Changes Extraction Tests", () => {
    // Setup: generate test documents before running tests
    beforeAll(async () => {
        testFiles = await generateTestSuite();
        expect(testFiles.length).toBeGreaterThan(0);
    });

    it("should not find tracked changes in a simple document", async () => {
        const simpleDocPath = path.resolve(process.cwd(), "tests/fixtures/simple.docx");
        expect(fs.existsSync(simpleDocPath)).toBe(true);

        const buffer = fs.readFileSync(simpleDocPath);
        const changes = await extractTrackedChanges(buffer);

        expect(changes).toEqual([]);
    });

    it("should extract insertions from a document with insertions only", async () => {
        const insertionsDocPath = path.resolve(process.cwd(), "tests/fixtures/insertions-only.docx");
        expect(fs.existsSync(insertionsDocPath)).toBe(true);

        const buffer = fs.readFileSync(insertionsDocPath);
        const changes = await extractTrackedChanges(buffer);

        expect(changes.length).toBeGreaterThan(0);

        // All changes should be insertions
        changes.forEach((change) => {
            expect(change.type).toBe("insertion");
        });

        // Should contain our specific insertions
        const insertionTexts = changes.map(change => change.text);
        expect(insertionTexts).toContain("inserted text");
        expect(insertionTexts).toContain("another insertion");

        // Author should be correct
        changes.forEach((change) => {
            expect(change.author).toBe("John Doe");
        });
    });

    it("should extract deletions from a document with deletions only", async () => {
        const deletionsDocPath = path.resolve(process.cwd(), "tests/fixtures/deletions-only.docx");
        expect(fs.existsSync(deletionsDocPath)).toBe(true);

        const buffer = fs.readFileSync(deletionsDocPath);
        const changes = await extractTrackedChanges(buffer);

        expect(changes.length).toBeGreaterThan(0);

        // All changes should be deletions
        changes.forEach((change) => {
            expect(change.type).toBe("deletion");
        });

        // Should contain our specific deletions
        const deletionTexts = changes.map(change => change.text);
        expect(deletionTexts).toContain("deleted text");
        expect(deletionTexts).toContain("another deletion");

        // Author should be correct
        changes.forEach((change) => {
            expect(change.author).toBe("Jane Smith");
        });
    });

    it("should extract both insertions and deletions from a mixed document", async () => {
        const mixedDocPath = path.resolve(process.cwd(), "tests/fixtures/mixed-changes.docx");
        expect(fs.existsSync(mixedDocPath)).toBe(true);

        const buffer = fs.readFileSync(mixedDocPath);
        const changes = await extractTrackedChanges(buffer);

        expect(changes.length).toBeGreaterThan(0);

        // Should have both insertions and deletions
        const insertions = changes.filter(change => change.type === "insertion");
        const deletions = changes.filter(change => change.type === "deletion");

        expect(insertions.length).toBeGreaterThan(0);
        expect(deletions.length).toBeGreaterThan(0);

        // Check specific texts
        expect(insertions.some(ins => ins.text === "important insertion")).toBe(true);
        expect(deletions.some(del => del.text === "unnecessary text")).toBe(true);

        // Author should be correct
        changes.forEach((change) => {
            expect(change.author).toBe("Mixed Author");
        });
    });

    it("should extract multiple changes from a complex document", async () => {
        const complexDocPath = path.resolve(process.cwd(), "tests/fixtures/complex.docx");
        expect(fs.existsSync(complexDocPath)).toBe(true);

        const buffer = fs.readFileSync(complexDocPath);
        const changes = await extractTrackedChanges(buffer);

        expect(changes.length).toBeGreaterThanOrEqual(4); // At least 4 changes

        const insertions = changes.filter(change => change.type === "insertion");
        const deletions = changes.filter(change => change.type === "deletion");

        expect(insertions.length).toBeGreaterThanOrEqual(2);
        expect(deletions.length).toBeGreaterThanOrEqual(2);

        // Check for specific insertions and deletions
        const insertionTexts = insertions.map(ins => ins.text);
        expect(insertionTexts).toContain("complex insertion");
        expect(insertionTexts).toContain("another complex insertion");

        const deletionTexts = deletions.map(del => del.text);
        expect(deletionTexts).toContain("complex deletion");
        expect(deletionTexts).toContain("another complex deletion");

        // Each change should have position and paragraph information
        changes.forEach((change) => {
            expect(typeof change.position).toBe("number");
            expect(change.paragraphIndex).not.toBeUndefined();
        });
    });
});
