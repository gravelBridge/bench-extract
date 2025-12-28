# bench-extract

Given URL(s) for a single model (announcement, blog post, model card PDF, etc.), five Gemini 3 Flash (preview) instances extract all benchmark scores reported for that model inside all provided URLs. All five extractions are sent to one "combiner" Gemini 3 Flash instance. This is done to maximize comprehensiveness and accuracy of extraction coverage.

To install dependencies:

```bash
bun install
```

To run:

First copy .env.example and create .env. Replace with your own AI Studio API key.

```bash
bun run index.ts [-m|--model-variant <variant>] <url1> [url2] [url3] ...
```

### Options

| Option                  | Description                                                                                                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-m`, `--model-variant` | Specify a model variant to extract (e.g. `thinking`, `pro`, `instant`, `reasoning`). **Recommended** for URLs that discuss multiple model variants (e.g. reasoning vs non-reasoning, different size tiers). If unspecified, all variations will be extracted. |

### Examples

Example results can be found in the results folder.

Extract benchmarks for a single model:

```bash
bun run index.ts https://example.com/model-announcement
```

Extract benchmarks for a specific variant when the URL covers multiple variants:

```bash
bun run index.ts -m thinking https://example.com/model-family-announcement
bun run index.ts --model-variant pro https://example.com/model-card.pdf
```

Results are stored under the results folder.

For some reason, the URL Context tool by Google doesn't seem to provide the full PDF content of links to PDFs. As a result, manual downloading and uploading of links detected to be PDFs is implemented to boost accuracy.

Built with the Gemini API, using the URL Context and Google Search tools.
