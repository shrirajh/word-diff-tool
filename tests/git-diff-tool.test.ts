import { describe, it, expect, beforeAll } from "vitest";
import { generateTestSuite } from "./utils/document-generator";
import { generateGitDiff, formatAsGitDiff } from "../src/git-diff-tool";
import { extractComments } from "../src/docx-utils";
import * as fs from "fs";
import * as path from "path";

// Generate test files once before all tests
let testFiles: string[] = [];

describe("Git Diff Tool Tests", () => {
    beforeAll(async () => {
        testFiles = await generateTestSuite();
        expect(testFiles.length).toBeGreaterThan(0);
    });

    describe("Comment Extraction", () => {
        it("should extract comments from a document with comments", async () => {
            const commentsDocPath = path.resolve(process.cwd(), "tests/fixtures/with-comments.docx");
            expect(fs.existsSync(commentsDocPath)).toBe(true);

            const comments = await extractComments(commentsDocPath);

            expect(comments.length).toBe(3);

            // Check first comment
            expect(comments[0].author).toBe("John Reviewer");
            expect(comments[0].text).toBe("This needs clarification");
            expect(comments[0].anchoredText).toBe("important content");
            expect(comments[0].paragraphNumber).toBe(1);

            // Check second comment
            expect(comments[1].author).toBe("Jane Editor");
            expect(comments[1].text).toBe("Consider rephrasing this section");
            expect(comments[1].anchoredText).toBe("technical details");
            expect(comments[1].paragraphNumber).toBe(2);

            // Check third comment
            expect(comments[2].author).toBe("Bob Manager");
            expect(comments[2].text).toBe("Approved with minor changes");
            expect(comments[2].anchoredText).toBe("approved text");
            expect(comments[2].paragraphNumber).toBe(3);
        });

        it("should return empty array for document without comments", async () => {
            const simpleDocPath = path.resolve(process.cwd(), "tests/fixtures/simple.docx");
            expect(fs.existsSync(simpleDocPath)).toBe(true);

            const comments = await extractComments(simpleDocPath);
            expect(comments.length).toBe(0);
        });
    });

    describe("Git Diff Generation", () => {
        it("should generate diff output for document with insertions", async () => {
            const insertionsDocPath = path.resolve(process.cwd(), "tests/fixtures/insertions-only.docx");
            expect(fs.existsSync(insertionsDocPath)).toBe(true);

            const diffOutput = await generateGitDiff(insertionsDocPath);

            expect(diffOutput.filename).toBe("insertions-only.docx");
            expect(diffOutput.changes.length).toBeGreaterThan(0);

            // Check that changes are additions
            const additions = diffOutput.changes.filter(c => c.type === "add");
            expect(additions.length).toBeGreaterThan(0);
            expect(additions.some(a => a.text === "inserted text")).toBe(true);
        });

        it("should generate diff output for document with deletions", async () => {
            const deletionsDocPath = path.resolve(process.cwd(), "tests/fixtures/deletions-only.docx");
            expect(fs.existsSync(deletionsDocPath)).toBe(true);

            const diffOutput = await generateGitDiff(deletionsDocPath);

            expect(diffOutput.filename).toBe("deletions-only.docx");
            expect(diffOutput.changes.length).toBeGreaterThan(0);

            // Check that changes are deletions
            const deletions = diffOutput.changes.filter(c => c.type === "delete");
            expect(deletions.length).toBeGreaterThan(0);
            expect(deletions.some(d => d.text === "deleted text")).toBe(true);
        });

        it("should generate diff output for document with mixed changes", async () => {
            const mixedDocPath = path.resolve(process.cwd(), "tests/fixtures/mixed-changes.docx");
            expect(fs.existsSync(mixedDocPath)).toBe(true);

            const diffOutput = await generateGitDiff(mixedDocPath);

            expect(diffOutput.filename).toBe("mixed-changes.docx");
            expect(diffOutput.changes.length).toBeGreaterThan(0);

            // Check for both additions and deletions
            const additions = diffOutput.changes.filter(c => c.type === "add");
            const deletions = diffOutput.changes.filter(c => c.type === "delete");

            expect(additions.length).toBeGreaterThan(0);
            expect(deletions.length).toBeGreaterThan(0);
        });

        it("should include comments in diff output", async () => {
            const commentsDocPath = path.resolve(process.cwd(), "tests/fixtures/with-comments.docx");
            expect(fs.existsSync(commentsDocPath)).toBe(true);

            const diffOutput = await generateGitDiff(commentsDocPath);

            expect(diffOutput.comments.length).toBe(3);
            expect(diffOutput.comments[0].author).toBe("John Reviewer");
        });

        it("should return empty changes for simple document", async () => {
            const simpleDocPath = path.resolve(process.cwd(), "tests/fixtures/simple.docx");
            expect(fs.existsSync(simpleDocPath)).toBe(true);

            const diffOutput = await generateGitDiff(simpleDocPath);

            expect(diffOutput.filename).toBe("simple.docx");
            expect(diffOutput.changes.length).toBe(0);
            expect(diffOutput.comments.length).toBe(0);
        });
    });

    describe("Git Diff Formatting", () => {
        it("should format diff output as git-style unified diff", async () => {
            const mixedDocPath = path.resolve(process.cwd(), "tests/fixtures/mixed-changes.docx");
            const diffOutput = await generateGitDiff(mixedDocPath);
            const formatted = formatAsGitDiff(diffOutput);

            // Check format explanation header
            expect(formatted).toContain("# Word Document Diff (Modified Format)");
            expect(formatted).toContain("# Format:");
            expect(formatted).toContain("+line = added text");

            // Check file header
            expect(formatted).toContain("diff --word a/mixed-changes.docx b/mixed-changes.docx");
            expect(formatted).toContain("--- a/mixed-changes.docx");
            expect(formatted).toContain("+++ b/mixed-changes.docx");

            // Check for paragraph markers
            expect(formatted).toContain("@@ paragraph");

            // Check for additions (+ prefix)
            expect(formatted).toContain("+");

            // Check for deletions (- prefix)
            expect(formatted).toContain("-");
        });

        it("should include comments interspersed with changes", async () => {
            const commentsDocPath = path.resolve(process.cwd(), "tests/fixtures/with-comments.docx");
            const diffOutput = await generateGitDiff(commentsDocPath);
            const formatted = formatAsGitDiff(diffOutput);

            // Check for comments with author and unique context
            expect(formatted).toContain("> [John Reviewer]:");
            expect(formatted).toContain("This needs clarification");
            expect(formatted).toContain("important content");
        });

        it("should group comments and changes by paragraph", async () => {
            const commentsDocPath = path.resolve(process.cwd(), "tests/fixtures/with-comments.docx");
            const diffOutput = await generateGitDiff(commentsDocPath);
            const formatted = formatAsGitDiff(diffOutput);

            // Check for paragraph headers
            expect(formatted).toContain("@@ paragraph 1 @@");
            expect(formatted).toContain("@@ paragraph 2 @@");
            expect(formatted).toContain("@@ paragraph 3 @@");

            // Verify comments appear under their respective paragraphs
            const lines = formatted.split("\n");
            let p1Index = lines.findIndex(l => l.includes("@@ paragraph 1 @@"));
            let p2Index = lines.findIndex(l => l.includes("@@ paragraph 2 @@"));

            // John Reviewer's comment should appear between p1 header and p2 header
            const johnCommentIndex = lines.findIndex(l => l.includes("John Reviewer"));
            expect(johnCommentIndex).toBeGreaterThan(p1Index);
            expect(johnCommentIndex).toBeLessThan(p2Index);
        });
    });
});
