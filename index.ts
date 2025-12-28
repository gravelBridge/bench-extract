import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({});

const systemPrompt = `Provide a JSON object of ALL benchmark results reported at the given URL. Be extremely thorough and comprehensive.
Use a new benchmark result entry for each variation of a benchmark reported (e.g. different thinking configurations, etc.).
You should use the URL context tool to extract the provided URL and use the search tool to find any missing information.
The current date is ${new Date().toISOString().split("T")[0]}.`;

const benchmarkResultSchema = z.object({
  name: z.string().describe("The name of the benchmark"),
  score: z.string().describe("The score of the benchmark"),
});

const benchmarkReportSchema = z.object({
  provider: z
    .string()
    .describe("The name of the provider that reported the benchmark results"),
  model: z.string().describe("The name of the model that was benchmarked"),
  date: z
    .string()
    .describe("The date of the release of the model in MM-DD-YYYY format"),
  url: z
    .url()
    .describe("The URL of the page that contains the benchmark results"),
  benchmarkResults: z
    .array(benchmarkResultSchema)
    .describe("An array of benchmark results"),
  notes: z
    .string()
    .optional()
    .describe(
      "Any clarifications regarding any of the benchmark results or your report that are non-obvious"
    ),
});

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: bun index.ts <url>");
    process.exit(1);
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: url,
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
      responseMimeType: "application/json",
      responseJsonSchema: benchmarkReportSchema.toJSONSchema(),
      systemInstruction: systemPrompt,
    },
  });

  const jsonResult = JSON.parse(response.text ?? "{}");
  const modelName = (jsonResult.model ?? "unknown").replace(/\s+/g, "-");
  const date = (jsonResult.date ?? "unknown").replace(/\s+/g, "-");
  const filename = `${modelName}-${date}.json`;

  await Bun.write(`results/${filename}`, JSON.stringify(jsonResult, null, 2));
  console.log(`Saved results to results/${filename}`);
}

main();
