import * as fs from "fs";
import * as path from "path";
import {
    Document,
    Paragraph,
    TextRun,
    InsertedTextRun,
    DeletedTextRun,
    Packer,
    SectionType,
} from "docx";

/**
 * Generates a Word document with sample content and tracked changes
 * using the docx library.
 */
export async function generateDocWithTrackedChanges(
    outputPath: string,
    options: {
        author?: string;
        insertions?: {
            text: string;
            position: number;
        }[];
        deletions?: {
            text: string;
            position: number;
        }[];
        regularContent?: string[];
    } = {},
): Promise<string> {
    const {
        author = "Test Author",
        insertions = [],
        deletions = [],
        regularContent = ["This is a test document.", "It contains regular content."],
    } = options;

    // Create paragraphs
    const paragraphs: Paragraph[] = [];

    // Add regular paragraphs
    for (const content of regularContent) {
        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: content,
                    }),
                ],
            }),
        );
    }

    let deltaIdx = 0;

    // Add paragraph with insertions
    if (insertions.length > 0) {
        const insertionParagraphChildren: (InsertedTextRun | DeletedTextRun | TextRun)[] = [
            new TextRun({
                text: "This paragraph contains ",
            }),
        ];

        // Add each insertion with separators
        for (let i = 0; i < insertions.length; i++) {
            const insertion = insertions[i];

            // Add insertion
            const insertedText = new TextRun({
                text: insertion.text,
            });

            insertionParagraphChildren.push(
                new InsertedTextRun({
                    id: deltaIdx++,
                    children: [insertedText],
                    author: author,
                    date: new Date().toISOString(),
                }),
            );

            // Add separator if not the last insertion
            if (i < insertions.length - 1) {
                insertionParagraphChildren.push(
                    new TextRun({
                        text: " and ",
                    }),
                );
            }
        }

        // Close the paragraph
        insertionParagraphChildren.push(
            new TextRun({
                text: " other content.",
            }),
        );

        // Add the paragraph to our collection
        paragraphs.push(
            new Paragraph({
                children: insertionParagraphChildren,
            }),
        );
    }

    // Add paragraph with deletions
    if (deletions.length > 0) {
        const deletionParagraphChildren: (InsertedTextRun | DeletedTextRun | TextRun)[] = [
            new TextRun({
                text: "This paragraph contains ",
            }),
        ];

        // Add each deletion with separators
        for (let i = 0; i < deletions.length; i++) {
            const deletion = deletions[i];

            // Add deletion
            const deletedText = new TextRun({
                text: deletion.text,
            });

            deletionParagraphChildren.push(
                new DeletedTextRun(
                    {
                        id: deltaIdx++,
                        children: [deletedText],
                        author: author,
                        date: new Date().toISOString(),
                    },
                ),
            );

            // Add separator if not the last deletion
            if (i < deletions.length - 1) {
                deletionParagraphChildren.push(
                    new TextRun({
                        text: " and ",
                    }),
                );
            }
        }

        // Close the paragraph
        deletionParagraphChildren.push(
            new TextRun({
                text: " deleted content.",
            }),
        );

        // Add the paragraph to our collection
        paragraphs.push(
            new Paragraph({
                children: deletionParagraphChildren,
            }),
        );
    }

    // Add a mixed paragraph with both insertions and deletions
    if (insertions.length > 0 && deletions.length > 0) {
        const insertedText = new TextRun({
            text: "inserted text",
        });

        const deletedText = new TextRun({
            text: "deleted text",
        });

        paragraphs.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: "This paragraph contains ",
                    }),
                    new InsertedTextRun({
                        id: deltaIdx++,
                        children: [insertedText],
                        author: author,
                        date: new Date().toISOString(),
                    }),
                    new TextRun({
                        text: " and ",
                    }),
                    new DeletedTextRun({
                        id: deltaIdx++,
                        children: [deletedText],
                        author: author,
                        date: new Date().toISOString(),
                    }),
                    new TextRun({
                        text: " mixed together.",
                    }),
                ],
            }),
        );
    }

    // Create a new document with a section
    const doc = new Document({
        creator: author,
        title: "Test Document with Tracked Changes",
        description: "Generated for testing purposes",
        sections: [
            {
                properties: {
                    type: SectionType.CONTINUOUS,
                },
                children: paragraphs,
            },
        ],
    });

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Generate and save the document
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
}

/**
 * Generates a document with highlighted text
 *
 * @param outputPath Path to save the document
 * @returns Path to the saved document
 */
export async function generateDocWithHighlights(outputPath: string): Promise<string> {
    // Create document
    const doc = new Document({
        creator: "Highlight Test",
        title: "Test Document with Highlighted Text",
        description: "Generated for testing highlight feature",
        sections: [
            {
                properties: {
                    type: SectionType.CONTINUOUS,
                },
                children: [
                    // Introduction paragraph
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This is a document with highlighted text.",
                            }),
                        ],
                    }),

                    // Paragraph with green highlighted text (additions)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This paragraph contains ",
                            }),
                            new TextRun({
                                text: "green highlighted text",
                                highlight: "green", // Word highlight for additions
                            }),
                            new TextRun({
                                text: " which should be treated as an addition.",
                            }),
                        ],
                    }),

                    // Paragraph with red highlighted text (deletions)
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This paragraph contains ",
                            }),
                            new TextRun({
                                text: "red highlighted text",
                                highlight: "red", // Word highlight for deletions
                            }),
                            new TextRun({
                                text: " which should be treated as a deletion.",
                            }),
                        ],
                    }),

                    // Paragraph with mixed highlights
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This paragraph has both ",
                            }),
                            new TextRun({
                                text: "added text",
                                highlight: "green",
                            }),
                            new TextRun({
                                text: " and ",
                            }),
                            new TextRun({
                                text: "deleted text",
                                highlight: "red",
                            }),
                            new TextRun({
                                text: " in the same paragraph.",
                            }),
                        ],
                    }),

                    // Paragraph with no highlights
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "This paragraph has no highlights and should be unchanged.",
                            }),
                        ],
                    }),
                ],
            },
        ],
    });

    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Generate and save the document
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
}

/**
 * Generates multiple test documents with different configurations
 */
export async function generateTestSuite(): Promise<string[]> {
    const outputDir = path.resolve(process.cwd(), "tests/fixtures");

    // Create fixtures directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate documents with different configurations
    const files = [
        // Simple document with no tracked changes
        await generateDocWithTrackedChanges(
            path.join(outputDir, "simple.docx"),
            {
                regularContent: [
                    "This is a simple document.",
                    "It has no tracked changes.",
                    "Just regular paragraphs of text.",
                ],
                insertions: [],
                deletions: [],
            },
        ),

        // Document with insertions only
        await generateDocWithTrackedChanges(
            path.join(outputDir, "insertions-only.docx"),
            {
                author: "John Doe",
                regularContent: ["This is a document with insertions only."],
                insertions: [
                    {
                        text: "inserted text",
                        position: 1,
                    },
                    {
                        text: "another insertion",
                        position: 2,
                    },
                ],
                deletions: [],
            },
        ),

        // Document with deletions only
        await generateDocWithTrackedChanges(
            path.join(outputDir, "deletions-only.docx"),
            {
                author: "Jane Smith",
                regularContent: ["This is a document with deletions only."],
                insertions: [],
                deletions: [
                    {
                        text: "deleted text",
                        position: 1,
                    },
                    {
                        text: "another deletion",
                        position: 2,
                    },
                ],
            },
        ),

        // Document with both insertions and deletions
        await generateDocWithTrackedChanges(
            path.join(outputDir, "mixed-changes.docx"),
            {
                author: "Mixed Author",
                regularContent: ["This is a document with mixed tracked changes."],
                insertions: [
                    {
                        text: "important insertion",
                        position: 1,
                    },
                ],
                deletions: [
                    {
                        text: "unnecessary text",
                        position: 2,
                    },
                ],
            },
        ),

        // Complex document with multiple authors
        await generateDocWithTrackedChanges(
            path.join(outputDir, "complex.docx"),
            {
                author: "Primary Author",
                regularContent: [
                    "This is a complex document with multiple paragraphs.",
                    "It demonstrates various tracked changes scenarios.",
                ],
                insertions: [
                    {
                        text: "complex insertion",
                        position: 1,
                    },
                    {
                        text: "another complex insertion",
                        position: 2,
                    },
                ],
                deletions: [
                    {
                        text: "complex deletion",
                        position: 1,
                    },
                    {
                        text: "another complex deletion",
                        position: 2,
                    },
                ],
            },
        ),

        // Document with highlighted text
        await generateDocWithHighlights(
            path.join(outputDir, "highlighted.docx"),
        ),
    ];

    return files;
}
