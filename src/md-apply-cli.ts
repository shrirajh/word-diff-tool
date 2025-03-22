#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import { applyMarkdownFile } from "./md-apply-tool";

const program = new Command();

program
  .name("md-apply-tool")
  .description("Applies critic markup changes in a markdown file")
  .version("1.0.0")
  .requiredOption("-i, --input <path>", "Path to the markdown file with critic markup")
  .option("-o, --output <path>", "Output file path (defaults to [original-filename]-clean.md)")
  .parse(process.argv);

const options = program.opts();

async function run() {
  try {
    const inputFilePath = options.input;
    const defaultOutputPath = path.join(
      path.dirname(inputFilePath),
      `${path.basename(inputFilePath, ".md")}-clean.md`
    );
    const outputPath = options.output || defaultOutputPath;

    console.log(`Applying changes from: ${inputFilePath}`);
    console.log(`Output will be written to: ${outputPath}`);

    await applyMarkdownFile(inputFilePath, outputPath);
    
    console.log("Changes applied successfully!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

run();