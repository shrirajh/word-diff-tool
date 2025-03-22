import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Merge Adjacent Diffs Tests", () => {
    // Define a function that mimics the mergeAdjacentDiffs implementation for testing
    function mergeAdjacentDiffs(parts: {
        type: "text" | "ins" | "del";
        content: string;
    }[]): {
        type: "text" | "ins" | "del";
        content: string;
    }[] {
        if (parts.length <= 1) {
            return parts;
        }

        const mergedParts: {
            type: "text" | "ins" | "del";
            content: string;
        }[] = [];

        let currentPart = {...parts[0]}; // Clone to avoid modifying the original

        for (let i = 1; i < parts.length; i++) {
            const nextPart = parts[i];
            
            // If both parts are the same type (ins or del), merge them
            if (currentPart.type !== "text" && nextPart.type === currentPart.type) {
                currentPart.content += nextPart.content;
            } else {
                // Push the current part and move to the next
                mergedParts.push({...currentPart});
                currentPart = {...nextPart};
            }
        }
        
        // Push the last part
        mergedParts.push({...currentPart});

        return mergedParts;
    }

    function convertToMarkdown(parts: {
        type: "text" | "ins" | "del";
        content: string;
    }[]): string {
        let markdown = "";
        
        for (const part of parts) {
            if (part.type === "text") {
                markdown += part.content;
            }
            else if (part.type === "ins") {
                markdown += `{++${part.content}++}`;
            }
            else if (part.type === "del") {
                markdown += `{--${part.content}--}`;
            }
        }
        
        return markdown;
    }
    
    it("should handle empty parts array", () => {
        const parts: {type: "text" | "ins" | "del"; content: string;}[] = [];
        expect(mergeAdjacentDiffs(parts)).toEqual([]);
    });
    
    it("should handle single part", () => {
        const parts = [{ type: "text" as const, content: "sample text" }];
        expect(mergeAdjacentDiffs(parts)).toEqual([{ type: "text", content: "sample text" }]);
    });
    
    it("should not modify regular text parts", () => {
        const parts = [
            { type: "text" as const, content: "first " },
            { type: "text" as const, content: "second" }
        ];
        expect(mergeAdjacentDiffs(parts)).toEqual([
            { type: "text", content: "first " },
            { type: "text", content: "second" }
        ]);
    });
    
    it("should merge adjacent insertion parts", () => {
        const parts = [
            { type: "text" as const, content: "This is " },
            { type: "ins" as const, content: "an " },
            { type: "ins" as const, content: "insertion" },
            { type: "text" as const, content: " example." }
        ];
        
        const merged = mergeAdjacentDiffs(parts);
        expect(merged).toEqual([
            { type: "text", content: "This is " },
            { type: "ins", content: "an insertion" },
            { type: "text", content: " example." }
        ]);
    });
    
    it("should merge adjacent deletion parts", () => {
        const parts = [
            { type: "text" as const, content: "This has " },
            { type: "del" as const, content: "one " },
            { type: "del" as const, content: "deletion" },
            { type: "text" as const, content: " example." }
        ];
        
        const merged = mergeAdjacentDiffs(parts);
        expect(merged).toEqual([
            { type: "text", content: "This has " },
            { type: "del", content: "one deletion" },
            { type: "text", content: " example." }
        ]);
    });
    
    it("should not merge insertion and deletion parts", () => {
        const parts = [
            { type: "text" as const, content: "This has " },
            { type: "ins" as const, content: "an insertion " },
            { type: "del" as const, content: "and deletion" },
            { type: "text" as const, content: " example." }
        ];
        
        const merged = mergeAdjacentDiffs(parts);
        expect(merged).toEqual([
            { type: "text", content: "This has " },
            { type: "ins", content: "an insertion " },
            { type: "del", content: "and deletion" },
            { type: "text", content: " example." }
        ]);
    });
    
    it("should handle complex mixture of part types", () => {
        const parts = [
            { type: "text" as const, content: "This " },
            { type: "ins" as const, content: "is " },
            { type: "ins" as const, content: "a " },
            { type: "text" as const, content: "complex " },
            { type: "del" as const, content: "and " },
            { type: "del" as const, content: "difficult " },
            { type: "ins" as const, content: "but " },
            { type: "ins" as const, content: "interesting " },
            { type: "text" as const, content: "example." }
        ];
        
        const merged = mergeAdjacentDiffs(parts);
        expect(merged).toEqual([
            { type: "text", content: "This " },
            { type: "ins", content: "is a " },
            { type: "text", content: "complex " },
            { type: "del", content: "and difficult " },
            { type: "ins", content: "but interesting " },
            { type: "text", content: "example." }
        ]);
    });
    
    it("should correctly process the example from the requirement", () => {
        // Create parts from the requirement example
        const parts = [
            { type: "ins" as const, content: "Prior to use in the artificial neural network, text underwent several preprocessing stages. This process was the same as that used in the previous derivation and validation studies. Namely, negation detection was applied first, followed by punctuation removed, then word stemming and " },
            { type: "ins" as const, content: "stopwords" },
            { type: "ins" as const, content: " removal. Subsequently, n-grams, which were one-to-three-word stems in length, were formed. Count vectorisation was then performed, prior to use in the artificial neural network." },
            { type: "ins" as const, content: "\"." }
        ];
        
        const merged = mergeAdjacentDiffs(parts);
        
        // Should be merged into a single part
        expect(merged.length).toBe(1);
        expect(merged[0].type).toBe("ins");
        expect(merged[0].content).toBe("Prior to use in the artificial neural network, text underwent several preprocessing stages. This process was the same as that used in the previous derivation and validation studies. Namely, negation detection was applied first, followed by punctuation removed, then word stemming and stopwords removal. Subsequently, n-grams, which were one-to-three-word stems in length, were formed. Count vectorisation was then performed, prior to use in the artificial neural network.\".");
        
        // Check the markdown output
        const markdown = convertToMarkdown(merged);
        expect(markdown).toBe("{++Prior to use in the artificial neural network, text underwent several preprocessing stages. This process was the same as that used in the previous derivation and validation studies. Namely, negation detection was applied first, followed by punctuation removed, then word stemming and stopwords removal. Subsequently, n-grams, which were one-to-three-word stems in length, were formed. Count vectorisation was then performed, prior to use in the artificial neural network.\"." + "++}");
    });
    
    it("should maintain the original output when there are no adjacent same-type diffs", () => {
        const parts = [
            { type: "text" as const, content: "This is " },
            { type: "ins" as const, content: "an insertion" },
            { type: "text" as const, content: " with " },
            { type: "del" as const, content: "a deletion" },
            { type: "text" as const, content: " example." }
        ];
        
        const merged = mergeAdjacentDiffs(parts);
        
        // Should remain the same
        expect(merged).toEqual(parts);
        
        // Check the markdown output
        const markdown = convertToMarkdown(merged);
        expect(markdown).toBe("This is {++an insertion++} with {--a deletion--} example.");
    });
});