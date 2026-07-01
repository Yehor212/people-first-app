export const DEFAULT_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_CHAT_MODEL = "gemini-3.5-flash";

export function buildGeminiGenerateContentUrl(
  model: string,
  endpointBase = DEFAULT_GEMINI_API_BASE,
): string {
  const normalizedModel = model.trim();
  if (!normalizedModel) {
    throw new Error("Gemini model is required");
  }
  return `${endpointBase.trim().replace(/\/+$/, "")}/models/${normalizedModel}:generateContent`;
}

export interface GeminiEmbeddingOptions {
  apiKey: string;
  model: string;
  dimensions: number;
  fetcher?: typeof fetch;
  endpointBase?: string;
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: unknown;
  };
}

function shouldRequestOutputDimensionality(model: string): boolean {
  return model.startsWith("gemini-embedding");
}

function parseEmbeddingValues(value: unknown, expectedDimensions: number): number[] {
  if (!Array.isArray(value)) {
    throw new Error("Gemini embedding response did not include values");
  }

  const values = value.map((item) => Number(item));
  if (values.some((item) => !Number.isFinite(item))) {
    throw new Error("Gemini embedding response included non-numeric values");
  }
  if (values.length !== expectedDimensions) {
    throw new Error(
      `Unexpected embedding dimensions: got ${values.length}, expected ${expectedDimensions}`,
    );
  }
  return values;
}

export async function generateGeminiEmbedding(
  text: string,
  options: GeminiEmbeddingOptions,
): Promise<number[]> {
  const fetcher = options.fetcher ?? fetch;
  const endpointBase = options.endpointBase ?? DEFAULT_GEMINI_API_BASE;
  const body: Record<string, unknown> = {
    content: { parts: [{ text }] },
  };

  if (shouldRequestOutputDimensionality(options.model)) {
    body.output_dimensionality = options.dimensions;
  }

  const response = await fetcher(`${endpointBase}/models/${options.model}:embedContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": options.apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini embedding API error: ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as GeminiEmbeddingResponse;
  return parseEmbeddingValues(result.embedding?.values, options.dimensions);
}
