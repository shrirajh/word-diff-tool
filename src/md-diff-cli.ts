#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import { diffMarkdownFiles } from "./md-diff-tool";

const program = new Command();

program
  .name("md-diff-tool")
  .description("Compares two markdown files with critic markup and generates a diff")
  .version("1.0.0")
  .requiredOption("-f, --first <path>", "Path to the first markdown file")
  .requiredOption("-s, --second <path>", "Path to the second markdown file")
  .option("-o, --output <path>", "Output file path (defaults to diff-result.md in current directory)")
  .parse(process.argv);

const options = program.opts();

async function run() {
  try {
    const firstFilePath = options.first;
    const secondFilePath = options.second;
    const outputPath = options.output || path.join(process.cwd(), "diff-result.md");

    console.log(`Comparing files: ${firstFilePath} and ${secondFilePath}`);
    console.log(`Output will be written to: ${outputPath}`);

    await diffMarkdownFiles(firstFilePath, secondFilePath, outputPath);
    
    console.log("Diff completed successfully!");
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

run();