import { describe, it, expect } from "vitest";
import { applyMarkdownChanges, createMarkdownDiff } from "../src/md-diff-tool";

describe("Markdown Diff Tool Tests", () => {
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
  });

  describe("createMarkdownDiff", () => {
    it("should create a diff with insertions", () => {
      const oldContent = "This is text.";
      const newContent = "This is modified text.";
      const result = createMarkdownDiff(oldContent, newContent);
      expect(result).toContain("{++modified ++}");
    });

    it("should create a diff with deletions", () => {
      const oldContent = "This is some long text.";
      const newContent = "This is text.";
      const result = createMarkdownDiff(oldContent, newContent);
      expect(result).toContain("{--some long --}");
    });

    it("should create a diff with both insertions and deletions", () => {
      const oldContent = "This is old text.";
      const newContent = "This was new content.";
      const result = createMarkdownDiff(oldContent, newContent);
      
      // Different diff algorithms may handle this differently,
      // so just check that the basic substitutions happen somehow
      expect(result).toContain("This ");
      expect(result).toContain("{--");
      expect(result).toContain("--}");
      expect(result).toContain("{++");
      expect(result).toContain("++}");
      
      // The diff should transform the old content to the new content when applied
      expect(applyMarkdownChanges(result)).toBe(newContent);
    });

    it("should handle multiline diffs", () => {
      const oldContent = "First line.\nSecond line.\nThird line.";
      const newContent = "First line.\nModified second line.\nThird line.\nAdded fourth line.";
      const result = createMarkdownDiff(oldContent, newContent);
      
      // Check for the presence of the main parts
      expect(result).toContain("First line.");
      expect(result).toContain("Third line.");
      expect(result).toContain("{--");
      expect(result).toContain("--}");
      expect(result).toContain("{++");
      expect(result).toContain("++}");
      expect(result).toContain("Modified");
      expect(result).toContain("Added fourth line.");
      
      // The diff should transform the old content to the new content when applied
      expect(applyMarkdownChanges(result)).toBe(newContent);
    });

    it("should produce identical output for identical inputs", () => {
      const content = "This content is unchanged.";
      const result = createMarkdownDiff(content, content);
      expect(result).toBe(content);
    });
  });
});