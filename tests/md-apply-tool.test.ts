import { describe, it, expect } from "vitest";
import { applyMarkdownChanges } from "../src/md-apply-tool";

describe("Markdown Apply Tool Tests", () => {
    describe("applyMarkdownChanges", () => {
        it("should apply insertions", () => {
            const input = "This is {++an inserted++} text.";
            expect(applyMarkdownChanges(input)).toBe("This is an inserted text.");
        });

        it("should apply deletions", () => {
            const input = "This is a {--deleted--} text.";
            expect(applyMarkdownChanges(input)).toBe("This is a  text.");
        });

        it("should apply both insertions and deletions", () => {
            const input = "This {--is--}{++was++} a test {++document++}.";
            expect(applyMarkdownChanges(input)).toBe("This was a test document.");
        });

        it("should handle nested markup", () => {
            const input = "This is {++really {--quite--} very++} important.";
            expect(applyMarkdownChanges(input)).toBe("This is really  very important.");
        });

        it("should handle multiline insertions and deletions", () => {
            const input = "First line.\n{++Second line.\nThird line.++}\n{--Fourth line.--}\nFifth line.";
            expect(applyMarkdownChanges(input)).toBe("First line.\nSecond line.\nThird line.\n\nFifth line.");
        });

        it("should handle complex documents with multiple changes", () => {
            const input = `# Sample Document with {++Different++} Markup

This is a paragraph with {++different ++}inserted text and {--deleted text--}{++no deletions++}.

## Second Section{++ Modified++}

This paragraph has {--old content--}{++completely updated content++} in the middle.

## Another Section

This paragraph is {++still ++}unchanged.

{++
## New Section

This is a completely new section that was added to the document.
++}`;

            const expected = `# Sample Document with Different Markup

This is a paragraph with different inserted text and no deletions.

## Second Section Modified

This paragraph has completely updated content in the middle.

## Another Section

This paragraph is still unchanged.


## New Section

This is a completely new section that was added to the document.
`;

            expect(applyMarkdownChanges(input)).toBe(expected);
        });
    });
});
