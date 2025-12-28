import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({});

const extractionSystemPrompt = `Provide a JSON object of ALL benchmark results reported at the given URL. Be extremely thorough and comprehensive.
Use a new benchmark result entry for each variation of a benchmark reported (e.g. different thinking configurations, etc.).
You should use the URL context tool to extract the provided URL and the search tool to find any missing information.
The current date is ${new Date().toISOString().split("T")[0]}.`;

const combineSystemPrompt = `You are given multiple JSON extractions of benchmark results from the same URL. Your task is to combine all the benchmark results into one comprehensive JSON object.
Be extremely thorough - include ALL benchmark results found across all the extractions. Deduplicate any results that appear in multiple extractions.
You should also use the URL context tool to fetch the URL and the search tool to verify and find any missing information. Ensure ALL results and notes are accurate.
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
    .describe("The date of release of the model in MM-DD-YYYY format"),
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

const NUM_EXTRACTIONS = 5;
let completedCount = 0;

async function extractBenchmarks(url: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: url,
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
      responseMimeType: "application/json",
      responseJsonSchema: benchmarkReportSchema.toJSONSchema(),
      systemInstruction: extractionSystemPrompt,
    },
  });
  completedCount++;
  console.log(`Completed extraction ${completedCount}/${NUM_EXTRACTIONS}`);
  return JSON.parse(response.text ?? "{}");
}

async function combineResults(url: string, extractions: unknown[]) {
  console.log("Combining extractions...");
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `URL (fetch this first with the URL context tool): ${url}

Here are ${
      extractions.length
    } separate extractions of benchmark results from the same URL. Please combine them into one comprehensive result:

${extractions
  .map((e, i) => `Extraction ${i + 1}:\n${JSON.stringify(e, null, 2)}`)
  .join("\n\n")}`,
    config: {
      tools: [{ googleSearch: {} }, { urlContext: {} }],
      responseMimeType: "application/json",
      responseJsonSchema: benchmarkReportSchema.toJSONSchema(),
      systemInstruction: combineSystemPrompt,
    },
  });
  console.log("Combination complete");
  return JSON.parse(response.text ?? "{}");
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: bun index.ts <url>");
    process.exit(1);
  }

  // Run extractions in parallel
  console.log(`Running ${NUM_EXTRACTIONS} extractions in parallel...`);
  const extractions = await Promise.all(
    Array.from({ length: NUM_EXTRACTIONS }, () => extractBenchmarks(url))
  );

  // Combine all extractions
  const combinedResult = await combineResults(url, extractions);

  const modelName = (combinedResult.model ?? "unknown").replace(/\s+/g, "-");
  const date = (combinedResult.date ?? "unknown").replace(/\s+/g, "-");
  const filename = `${modelName}-${date}.json`;

  await Bun.write(
    `results/${filename}`,
    JSON.stringify(combinedResult, null, 2)
  );
  console.log(`Saved results to results/${filename}`);
}

main();
