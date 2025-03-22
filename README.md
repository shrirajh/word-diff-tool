# Word-Diff-Tool: A Toolkit for Tracked Changes in Documents

A suite of command-line tools for working with tracked changes in different formats, using CriticMarkup syntax as a common format.

## Tools Included

1. **word-diff-tool**: Converts Word documents (.docx) with tracked changes into Markdown format
2. **md-diff-tool**: Compares two Markdown files with CriticMarkup and generates a diff file
3. **md-apply-tool**: Applies CriticMarkup changes in a Markdown file

## Features

- Directly extracts content and tracked changes from Word documents
- Works with complex DOCX files containing tracked changes
- Creates diffs between Markdown files with tracked changes
- Applies tracked changes to create clean documents
- Uses CriticMarkup syntax for consistent representation:
  - Insertions: `{++added text++}`
  - Deletions: `{--removed text--}`
- Formats converted content with basic Markdown conventions

## Installation

```bash
# Clone the repository
git clone https://github.com/shrirajh/word-diff-tool.git
cd word-diff-tool

# Install dependencies
npm install

# Build the project
npm run build

# Make the CLI executable
chmod +x dist/index.js

# Create a global symlink (optional)
npm link
```

## Usage

### Word to Markdown Conversion

```bash
# Convert Word document with tracked changes to Markdown
word-diff-tool input.docx

# Specify an output file
word-diff-tool input.docx -o output.md
```

### Markdown Diff Tool

```bash
# Compare two Markdown files with CriticMarkup
md-diff-tool --first file1.md --second file2.md

# Specify an output file
md-diff-tool --first file1.md --second file2.md --output diff-result.md
```

### Markdown Apply Tool

```bash
# Apply CriticMarkup changes in a file
md-apply-tool --input document-with-changes.md

# Specify an output file
md-apply-tool --input document-with-changes.md --output clean-document.md
```

## Examples

```bash
# Process a Word document
word-diff-tool trackingtest1.docx

# Generate a diff between two Markdown files
md-diff-tool --first original.md --second revised.md --output diff.md

# Apply changes from a Markdown file with CriticMarkup
md-apply-tool --input diff.md --output final.md
```

## How It Works

### word-diff-tool

The Word to Markdown converter takes a fundamentally different approach compared to other tools:

1. **Direct XML Processing**: Instead of converting to an intermediate format (like HTML), the tool directly processes the Word document's XML structure
2. **Tracked Changes Integration**: Insertions and deletions are extracted during the XML processing, preserving their original positions
3. **Content Building**: The tool reconstructs the document content piece by piece, inserting tracked changes at the appropriate positions
4. **Markdown Formatting**: The final step applies basic Markdown formatting conventions to the text

This approach ensures that tracked changes appear in the correct locations within the document, avoiding position calculation issues that can occur with other approaches.

### md-diff-tool

The Markdown Diff Tool uses the diff-match-patch algorithm to compare texts:

1. **Change Application**: First applies any existing CriticMarkup changes in both input files
2. **Diff Generation**: Compares the resulting clean texts using a semantic diff algorithm
3. **Markup Creation**: Formats the differences using CriticMarkup syntax:
   - Additions are marked with `{++text++}`
   - Deletions are marked with `{--text--}`

The tool is designed to handle nested changes and complex differences effectively.

### md-apply-tool

The Markdown Apply Tool processes CriticMarkup syntax:

1. **Deletion Processing**: First removes content marked for deletion
2. **Insertion Processing**: Preserves content marked for insertion while removing the markup
3. **Clean Output**: Produces a final document with all changes applied

This sequential processing ensures that nested markup is handled correctly.

## Dependencies

- jszip: For extracting content from .docx files
- commander: For building the CLI interface
- diff-match-patch-es: For generating semantic diffs between texts

## Technical Notes

Word documents store tracked changes in their XML structure using specific tags:
- Insertions: `<w:ins>` elements 
- Deletions: `<w:del>` elements with `<w:delText>` content

The diff tools use the CriticMarkup syntax, which is a standard for marking up changes in Markdown files:
- Insertions: `{++added text++}`
- Deletions: `{--removed text--}`

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.