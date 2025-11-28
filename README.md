# word-diff-tool

CLI tools for extracting tracked changes and comments from Word documents.

## Tools

| Command | Description |
|---------|-------------|
| `word-diff-tool` | Convert .docx with tracked changes to Markdown with CriticMarkup |
| `word-git-diff` | Generate git-style diff output from .docx with tracked changes and comments |
| `md-diff-tool` | Compare two Markdown files, output CriticMarkup diff |
| `md-apply-tool` | Apply CriticMarkup changes to produce clean output |

## Installation

```bash
npm install
npm run build
npm link  # optional, for global CLI access
```

## word-diff-tool

Converts Word documents with tracked changes to Markdown using CriticMarkup syntax.

```bash
word-diff-tool document.docx                    # output to stdout
word-diff-tool document.docx -o output.md       # output to file
word-diff-tool document.docx -h                 # treat highlights as changes (green=add, red=delete)
```

Output uses CriticMarkup:
- `{++added text++}` for insertions
- `{--deleted text--}` for deletions

## word-git-diff

Generates a git-style diff showing tracked changes and comments from Word documents.

```bash
word-git-diff document.docx                     # output to stdout
word-git-diff document.docx -o output.diff      # output to file
word-git-diff document.docx --json              # output as JSON
```

### Output Format

```
# Word Document Diff (Modified Format)
# =====================================
# This is a modified diff format for Word documents with tracked changes.
#
# Format:
#   +line = added text
#   -line = deleted text
#   > [author]: comment text (interspersed with changes in document order)
#   @@ paragraph N @@ = paragraph number where changes occur
#
# Context (after #):
#   "before [...] after" = surrounding text with [...] marking where the change occurs
#   "before [selected] after" = for comments, [brackets] mark the commented text
#   "before>|<after" = for point comments (no selection), >|< marks cursor position
#   ... = truncated text
#   Context auto-expands until unique in the document
#

diff --word a/document.docx b/document.docx
--- a/document.docx
+++ b/document.docx
@@ paragraph 2 @@
+new text  # "...before [...] after..."
-removed text  # "...before [...] after..."
> [John Smith]: Please review this section  # "selected text"
@@ paragraph 5 @@
> [Jane Doe]: Consider rewording  # "...context>|<more context..."
```

Features:
- Tracked changes shown as `+` (additions) and `-` (deletions)
- Comments shown with `>` prefix, interspersed in document order
- Context auto-expands to be unique within the document
- Comments on selected text show `[the selected text]`
- Point comments (no selection) show cursor position as `>|<`

## md-diff-tool

Compares two Markdown files and outputs the differences in CriticMarkup.

```bash
md-diff-tool --first original.md --second revised.md
md-diff-tool --first original.md --second revised.md --output diff.md
```

## md-apply-tool

Applies CriticMarkup changes to produce a clean document.

```bash
md-apply-tool --input document-with-markup.md
md-apply-tool --input document-with-markup.md --output clean.md
```

## How It Works

### Word Document Processing

The tools directly parse the `.docx` XML structure:

- **document.xml**: Contains paragraphs (`<w:p>`), runs (`<w:r>`), and tracked changes (`<w:ins>`, `<w:del>`)
- **comments.xml**: Contains comment text, author, and date
- **Comment ranges**: `<w:commentRangeStart>` and `<w:commentRangeEnd>` in document.xml mark what text a comment is attached to

### CriticMarkup Syntax

```
This is {++inserted++} text.
This is {--deleted--} text.
This is {~~replaced~>with new~~} text.
```

## Dependencies

- `jszip` - Extract XML from .docx files
- `commander` - CLI interface
- `diff-match-patch-es` - Semantic diff algorithm

## License

ISC
