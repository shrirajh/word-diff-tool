#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import path from "path";
import { processDocxWithTrackedChanges } from "./processor";

const program = new Command();

program
    .name("word-diff-tool")
    .description("Convert Word documents with tracked changes to markdown with inline diffs")
    .version("1.0.0");

program
    .argument("<input>", "Path to the input Word document (.docx)")
    .option("-o, --output <file>", "Output markdown file path (defaults to input filename with .md extension)")
    .option("-h, --highlight", "Treat green highlighted text as additions and red highlighted text as deletions")
    .action(async (input, options) => {
        try {
            // Validate input file
            if (!fs.existsSync(input)) {
                console.error(`Error: Input file not found: ${input}`);
                process.exit(1);
            }

            if (!input.toLowerCase().endsWith(".docx")) {
                console.error("Error: Input file must be a .docx file");
                process.exit(1);
            }

            // Determine output path
            const outputPath = options.output || path.join(
                path.dirname(input),
                `${path.basename(input, ".docx")}.md`,
            );

            console.log(`Processing: ${input}`);
            console.log(`Output will be saved to: ${outputPath}`);

            // Process the document
            const markdown = await processDocxWithTrackedChanges(input, options.highlight);

            // Write output
            fs.writeFileSync(outputPath, markdown);
            console.log("✅ Conversion complete!");
        }
        catch (error) {
            console.error("Error processing document:", error);
            process.exit(1);
        }
    });

program.parse();
