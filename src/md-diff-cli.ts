#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import { diffMarkdownFiles } from "./md-diff-tool";

const program = new Command();

program
  .name("md-diff-tool")
  .description("Compares two markdown files with critic markup and generates a diff")
  .version("1.0.0")
  .requiredOption("-f, --first <path>", "Path to the first markdown file")
  .requiredOption("-s, --second <path>", "Path to the second markdown file")
  .option("-o, --output <path>", "Output to file instead of stdout")
  .parse(process.argv);

const options = program.opts();

async function run() {
  try {
    const firstFilePath = options.first;
    const secondFilePath = options.second;

    // Validate input files exist
    if (!fs.existsSync(firstFilePath)) {
      console.error(`Error: First file not found: ${firstFilePath}`);
      process.exit(1);
    }
    if (!fs.existsSync(secondFilePath)) {
      console.error(`Error: Second file not found: ${secondFilePath}`);
      process.exit(1);
    }

    const result = await diffMarkdownFiles(firstFilePath, secondFilePath, options.output);

    // Output to stdout if no output file specified
    if (!options.output) {
      process.stdout.write(result);
    } else {
      console.error(`✅ Output written to: ${options.output}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

run();