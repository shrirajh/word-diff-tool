import fs from "fs/promises";
import path from "path";

/**
 * Applies the critic markup changes in a markdown file
 * - Insertions {++text++} - keeps the content within the markup
 * - Deletions {--text--} - removes the content within the markup
 * 
 * @param markdownContent The content with critic markup
 * @returns The content with changes applied
 */
export function applyMarkdownChanges(markdownContent: string): string {
  // First handle deletions, then insertions to avoid nested markup issues
  
  // Parse deletions {--text--} - remove them completely
  let result = markdownContent.replace(/\{\-\-(.*?)\-\-\}/gs, "");
  
  // Parse insertions {++text++} - keep the content without markup
  result = result.replace(/\{\+\+(.*?)\+\+\}/gs, "$1");
  
  return result;
}

/**
 * Process a markdown file containing critic markup and apply all changes
 * 
 * @param filePath Path to the markdown file with critic markup
 * @param outputPath Path to write the output file
 * @returns Promise<string> The processed content
 */
export async function applyMarkdownFile(
  filePath: string,
  outputPath?: string
): Promise<string> {
  try {
    // Read the input file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    
    // Apply the changes
    const processedContent = applyMarkdownChanges(fileContent);
    
    // Write to output file if path is provided
    if (outputPath) {
      await fs.writeFile(outputPath, processedContent, 'utf-8');
    }
    
    return processedContent;
  } catch (error) {
    throw new Error(`Error applying markdown changes: ${error instanceof Error ? error.message : String(error)}`);
  }
}