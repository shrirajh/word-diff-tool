#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import { applyMarkdownFile } from "./md-apply-tool";

const program = new Command();

program
    .name("md-apply-tool")
    .description("Applies critic markup changes in a markdown file")
    .version("1.0.0")
    .requiredOption("-i, --input <path>", "Path to the markdown file with critic markup")
    .option("-o, --output <path>", "Output to file instead of stdout")
    .parse(process.argv);

const options = program.opts();

async function run() {
    try {
        const inputFilePath = options.input;

        // Validate input file exists
        if (!fs.existsSync(inputFilePath)) {
            console.error(`Error: Input file not found: ${inputFilePath}`);
            process.exit(1);
        }

        const result = await applyMarkdownFile(inputFilePath, options.output);

        // Output to stdout if no output file specified
        if (!options.output) {
            process.stdout.write(result);
        }
        else {
            console.error(`✅ Output written to: ${options.output}`);
        }
    }
    catch (error) {
        console.error("Error:", error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

run();
