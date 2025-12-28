# bench-extract

Given a URL (announcement, blog post, model card PDF), five Gemini 3 Flash (preview) instances extract all benchmark scores reported. All five extractions are sent to one "combiner" Gemini 3 Flash instance. This is done to maximize comprehensiveness and accuracy of extraction coverage.

To install dependencies:

```bash
bun install
```

To run:

First copy .env.example and create .env. Replace with your own AI Studio API key.

```bash
bun run index.ts <url>
```

Results are stored under the results folder.

AI SDK was not used in this project due to tool call results not supporting PDFs for Gemini. A to-do is to move it over to the AI SDK once PDF tool call results for Gemini are fixed in the AI SDK.

For some reason, the URL Context tool by Google doesn't seem to provide the full PDF content of links to PDFs. As a result, manual downloading and uploading of links detected to be PDFs is implemented to boost accuracy.

Built with the Gemini API, using the URL Context and Google Search tools.
