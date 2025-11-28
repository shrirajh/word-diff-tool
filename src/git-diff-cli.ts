#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import { generateGitDiff, formatAsGitDiff } from "./git-diff-tool";

const program = new Command();

program
    .name("word-git-diff")
    .description("Generate git-style diff output from Word documents with tracked changes and comments")
    .version("1.0.0");

program
    .argument("<input>", "Path to the input Word document (.docx)")
    .option("-o, --output <file>", "Output to file instead of stdout")
    .option("--json", "Output as JSON instead of git diff format")
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

            // Process the document
            const diffOutput = await generateGitDiff(input);

            // Format output
            let output: string;
            if (options.json) {
                output = JSON.stringify(diffOutput, null, 2);
            } else {
                output = formatAsGitDiff(diffOutput);
            }

            // Output to file or stdout
            if (options.output) {
                fs.writeFileSync(options.output, output);
                console.error(`✅ Output written to: ${options.output}`);
            } else {
                process.stdout.write(output + "\n");
            }
        }
        catch (error) {
            console.error("Error processing document:", error);
            process.exit(1);
        }
    });

program.parse();
