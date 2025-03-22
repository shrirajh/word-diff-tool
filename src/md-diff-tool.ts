import fs from "fs/promises";
import path from "path";
import { diff, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL, diffCleanupSemantic } from "diff-match-patch-es";

/**
 * Parses Critic Markup from a string
 */
function parseCriticMarkup(text: string): string {
  // First handle deletions, then insertions to avoid nested markup issues

  // Parse deletions {--text--} - remove them completely
  let result = text.replace(/\{\-\-(.*?)\-\-\}/gs, "");
  
  // Parse insertions {++text++} - keep the content without markup
  result = result.replace(/\{\+\+(.*?)\+\+\}/gs, "$1");
  
  return result;
}

/**
 * Applies the changes in markdown files with critic markup
 * 
 * @param markdownContent The content with critic markup
 * @returns The content with changes applied
 */
export function applyMarkdownChanges(markdownContent: string): string {
  return parseCriticMarkup(markdownContent);
}

/**
 * Creates a diff between two strings and formats it with critic markup
 * 
 * @param oldContent Original content
 * @param newContent New content
 * @returns Diff with critic markup
 */
export function createMarkdownDiff(oldContent: string, newContent: string): string {
  const diffs = diff(oldContent, newContent);
  
  // Optimize the diffs to merge adjacent operations
  diffCleanupSemantic(diffs);
  
  let result = '';
  
  for (const [operation, text] of diffs) {
    if (operation === DIFF_EQUAL) {
      result += text;
    } else if (operation === DIFF_INSERT) {
      result += `{++${text}++}`;
    } else if (operation === DIFF_DELETE) {
      result += `{--${text}--}`;
    }
  }
  
  return result;
}

/**
 * Process two markdown files with critic markup and create a diff 
 * 
 * @param file1Path Path to the first markdown file
 * @param file2Path Path to the second markdown file
 * @param outputPath Path to write the output diff
 * @returns Promise<void>
 */
export async function diffMarkdownFiles(
  file1Path: string, 
  file2Path: string, 
  outputPath?: string
): Promise<string> {
  try {
    // Read the input files
    const file1Content = await fs.readFile(file1Path, 'utf-8');
    const file2Content = await fs.readFile(file2Path, 'utf-8');
    
    // Apply the changes from both files
    const cleanText1 = applyMarkdownChanges(file1Content);
    const cleanText2 = applyMarkdownChanges(file2Content);
    
    // Generate a diff between the cleaned texts
    const diffText = createMarkdownDiff(cleanText1, cleanText2);
    
    // Write to output file if path is provided
    if (outputPath) {
      await fs.writeFile(outputPath, diffText, 'utf-8');
    }
    
    return diffText;
  } catch (error) {
    throw new Error(`Error processing markdown files: ${error instanceof Error ? error.message : String(error)}`);
  }
}