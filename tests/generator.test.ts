import { describe, it, expect, afterAll } from "vitest";
import { generateDocWithTrackedChanges } from "./utils/document-generator";
import { extractTrackedChanges } from "../src/tracked-changes";
import * as fs from "fs";
import * as path from "path";

const testOutputPath = path.resolve(process.cwd(), "tests/fixtures/custom-test.docx");

describe("DOCX Generator Tests", () => {
    // Clean up the test file after tests
    afterAll(() => {
        if (fs.existsSync(testOutputPath)) {
            fs.unlinkSync(testOutputPath);
        }
    });

    it("should generate a custom document with specified tracked changes", async () => {
    // Generate a test document with custom content and tracked changes
        const filePath = await generateDocWithTrackedChanges(testOutputPath, {
            author: "Test User",
            regularContent: [
                "This is a custom paragraph.",
                "Another paragraph with regular text.",
            ],
            insertions: [
                {
                    text: "custom insertion",
                    position: 1,
                },
            ],
            deletions: [
                {
                    text: "custom deletion",
                    position: 2,
                },
            ],
        });

        // Verify the file was created
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(0);

        // Use our library to extract tracked changes from the generated document
        const buffer = fs.readFileSync(filePath);
        const changes = await extractTrackedChanges(buffer);

        // Verify the tracked changes were correctly added
        expect(changes.length).toBeGreaterThan(0);

        // Check for the insertion
        const insertions = changes.filter(change => change.type === "insertion");
        expect(insertions.length).toBeGreaterThan(0);
        expect(insertions.some(ins => ins.text === "custom insertion")).toBe(true);

        // Check for the deletion
        const deletions = changes.filter(change => change.type === "deletion");
        expect(deletions.length).toBeGreaterThan(0);
        expect(deletions.some(del => del.text === "custom deletion")).toBe(true);

        // Verify the author was set correctly
        changes.forEach((change) => {
            expect(change.author).toBe("Test User");
        });
    });
});
