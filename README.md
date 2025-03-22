# Word-Diff-Tool: DOCX to Markdown with Tracked Changes

A command-line tool that converts Word documents (.docx) with tracked changes into Markdown format, preserving the tracked changes as inline diffs.

## Features

- Directly extracts content and tracked changes from Word documents
- Works with complex DOCX files containing tracked changes
- Preserves tracked changes as inline diff markers in Markdown
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

```bash
# Basic usage
word-diff-tool input.docx

# Specify an output file
word-diff-tool input.docx -o output.md
```

## Examples

```bash
# Process the sample document
word-diff-tool trackingtest1.docx
```

## How It Works

The tool takes a fundamentally different approach compared to other Word-to-Markdown converters:

1. **Direct XML Processing**: Instead of converting to an intermediate format (like HTML), the tool directly processes the Word document's XML structure
2. **Tracked Changes Integration**: Insertions and deletions are extracted during the XML processing, preserving their original positions
3. **Content Building**: The tool reconstructs the document content piece by piece, inserting tracked changes at the appropriate positions
4. **Markdown Formatting**: The final step applies basic Markdown formatting conventions to the text

This approach ensures that tracked changes appear in the correct locations within the document, avoiding position calculation issues that can occur with other approaches.

## Dependencies

- jszip: For extracting content from .docx files
- commander: For building the CLI interface

## Technical Notes

Word documents store tracked changes in their XML structure using specific tags:
- Insertions: `<w:ins>` elements 
- Deletions: `<w:del>` elements with `<w:delText>` content

The tool parses these elements to extract both the change content and its contextual position within the document.

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.