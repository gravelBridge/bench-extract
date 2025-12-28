# bench-extract

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts <url>
```

AI SDK was not used in this project due to tool call results not supporting PDFs for Gemini. A to-do is to move it over to the AI SDK once PDF tool call results for Gemini are fixed.

For some reason, the URL Context tool by Google doesn't seem to provide the full PDF content of links to PDFs. As a result, manual downloading and uploading of PDF links is implemented to boost accuracy.

Built with the Gemini API, using the URL Context and Google Search tools.
