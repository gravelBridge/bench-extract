import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({});

interface PdfData {
  mimeType: "application/pdf";
  data: string; // base64
}

interface UrlWithPdf {
  url: string;
  pdfData: PdfData | null;
}

async function downloadPdf(url: string): Promise<PdfData | null> {
  const isPdfUrl = url.toLowerCase().endsWith(".pdf");

  if (!isPdfUrl) {
    try {
      const headResp = await fetch(url, { method: "HEAD" });
      const contentType = headResp.headers.get("content-type");
      if (!contentType?.includes("application/pdf")) {
        return null;
      }
    } catch {
      return null;
    }
  }

  console.log("Downloading PDF...");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download PDF: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  console.log(
    `PDF downloaded (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`
  );

  return {
    mimeType: "application/pdf",
    data: base64,
  };
}

const extractionSystemPrompt = `Provide a JSON object of ALL benchmark results reported at the given URL(s) and/or attachment(s). Be extremely thorough and comprehensive.
Use a new benchmark result entry for each variation of a benchmark reported (e.g. different thinking configurations, etc.).
You MUST use the URL context tool to extract EACH of the provided URL(s) individually and the search tool (if necessary) to find the model release date.
Do not use the search tool to find any other information besides the model release date. The information inside the URL(s) and/or attachment(s) is the source of truth for benchmark results.
The current date is ${new Date().toISOString().split("T")[0]}.`;

const combineSystemPrompt = `You are given multiple extractions of benchmark results from the same URL(s) and/or attachment(s). Your task is to combine all the benchmark results into one comprehensive, accurate JSON object.
Be extremely thorough - include ALL benchmark results found across any of the extractions as long as they are accurate. Deduplicate any results that appear in multiple extractions.
You MUST use the URL context tool to extract EACH of the provided URL(s) individually and the search tool (if necessary) to find the model release date.
Do not use the search tool to find any other information besides the model release date. The information inside the URL(s) and/or attachment(s) is the source of truth for benchmark results.
Ensure ALL results and notes are accurate.
The current date is ${new Date().toISOString().split("T")[0]}.`;

const benchmarkResultSchema = z.object({
  name: z.string().describe("The name of the benchmark"),
  score: z.string().describe("The score of the benchmark"),
});

const benchmarkReportSchema = z.object({
  provider: z
    .string()
    .describe(
      "The name of the provider that developed the model that was benchmarked"
    ),
  model: z.string().describe("The name of the model that was benchmarked"),
  date: z
    .string()
    .describe("The date of release of the model in MM-DD-YYYY format"),
  urls: z
    .array(z.url())
    .describe("The URL(s) of the page(s) that contain the benchmark results"),
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

async function extractBenchmarks(urlsWithPdfs: UrlWithPdf[]) {
  const urls = urlsWithPdfs.map((u) => u.url).join("\n");
  const contents: Part[] = [{ text: urls }];

  for (const { pdfData } of urlsWithPdfs) {
    if (pdfData) {
      contents.push({
        inlineData: pdfData,
      });
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
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

async function combineResults(
  urlsWithPdfs: UrlWithPdf[],
  extractions: unknown[]
) {
  console.log("Combining extractions...");

  const urls = urlsWithPdfs.map((u) => u.url).join("\n");
  const textContent = `URL(s) (fetch these first with the URL context tool):
${urls}

Here are ${
    extractions.length
  } separate extractions of benchmark results from the same URL(s) and/or attachment(s). Combine them into one comprehensive, accurate result:

${extractions
  .map((e, i) => `Extraction ${i + 1}:\n${JSON.stringify(e, null, 2)}`)
  .join("\n\n")}`;

  const contents: Part[] = [{ text: textContent }];

  for (const { pdfData } of urlsWithPdfs) {
    if (pdfData) {
      contents.push({
        inlineData: pdfData,
      });
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
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
  const urls = process.argv.slice(2);
  if (urls.length === 0) {
    console.error("Usage: bun index.ts <url1> [url2] [url3] ...");
    process.exit(1);
  }

  console.log(`Processing ${urls.length} URL(s)...`);

  // Download PDFs for all URLs that are PDFs
  const urlsWithPdfs: UrlWithPdf[] = await Promise.all(
    urls.map(async (url) => ({
      url,
      pdfData: await downloadPdf(url),
    }))
  );

  const pdfCount = urlsWithPdfs.filter((u) => u.pdfData).length;
  if (pdfCount > 0) {
    console.log(
      `${pdfCount} PDF(s) will be attached to extraction and combination requests`
    );
  }

  // Run extractions in parallel
  console.log(`Running ${NUM_EXTRACTIONS} extractions in parallel...`);
  const extractions = await Promise.all(
    Array.from({ length: NUM_EXTRACTIONS }, () =>
      extractBenchmarks(urlsWithPdfs)
    )
  );

  // Combine all extractions
  const combinedResult = await combineResults(urlsWithPdfs, extractions);

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
