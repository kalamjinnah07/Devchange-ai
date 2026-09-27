/**
 * lib/ai.ts
 *
 * AI provider abstraction for DevChange AI.
 *
 * Supports:
 * - IBM watsonx.ai
 * - Google Gemini
 *
 * Active provider is selected using AI_PROVIDER.
 */

export interface AIProvider {
  stream(prompt: string): Promise<ReadableStream<Uint8Array>>;
}

/* -------------------------------------------------------------------------- */
/* Gemini Provider                                                            */
/* -------------------------------------------------------------------------- */

function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelId =
    process.env.GEMINI_MODEL_ID ?? "gemini-3.8-flash";

  if (!apiKey) {
    throw new Error(
      "Missing required environment variable: GEMINI_API_KEY"
    );
  }

  return {
    apiKey,
    modelId,
  };
}

/**
 * Perform a single HTTP call to the Gemini streamGenerateContent endpoint,
 * retrying only on transient HTTP-level failures (before any bytes of the
 * stream have arrived).
 */
async function fetchGeminiStream(
  endpoint: string,
  apiKey: string,
  requestBody: unknown
): Promise<Response> {
  let response: Response | null = null;

  const maxRetries = 4;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      break;
    }

    // Retry only temporary server/rate-limit errors.
    if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
      break;
    }

    if (attempt === maxRetries) {
      break;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s.
    const delay = Math.pow(2, attempt) * 1000;

    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (!response) {
    throw new Error("Gemini API request failed without a response");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");

    throw new Error(`Gemini API error: HTTP ${response.status} — ${body}`);
  }

  if (!response.body) {
    throw new Error("Gemini returned an empty response body");
  }

  return response;
}

interface GeminiAttemptResult {
  /** Pre-encoded SSE chunks already converted to the app's wire format. */
  chunks: Uint8Array[];
  /** Gemini's reported stop reason (e.g. "STOP", "MAX_TOKENS"), or null if
   *  the connection ended without ever reporting one. */
  finishReason: string | null;
}

/**
 * Read one Gemini SSE response to completion and convert each event from:
 *   data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
 * into the SSE format already expected by the DevChange AI frontend:
 *   data: {"results":[{"generated_text":"..."}]}
 *
 * The whole response is buffered in memory (it's a short 7-section report)
 * so the caller can tell a genuinely complete generation apart from a
 * connection that was cut off mid-stream — see the retry loop in
 * GeminiProvider.stream() for why that distinction matters.
 */
async function collectGeminiStream(
  response: Response
): Promise<GeminiAttemptResult> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = response.body!.getReader();

  let buffer = "";
  let finishReason: string | null = null;
  const chunks: Uint8Array[] = [];

  const handleLine = (line: string) => {
    const trimmed = line.trim();

    if (!trimmed.startsWith("data:")) {
      return;
    }

    const jsonText = trimmed.slice(5).trim();

    if (!jsonText || jsonText === "[DONE]") {
      return;
    }

    try {
      const data = JSON.parse(jsonText);
      const candidate = data?.candidates?.[0];

      if (candidate?.finishReason) {
        finishReason = candidate.finishReason;
      }

      const text =
        candidate?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("") ?? "";

      if (!text) {
        return;
      }

      chunks.push(
        encoder.encode(
          `data: ${JSON.stringify({
            results: [{ generated_text: text }],
          })}\n\n`
        )
      );
    } catch {
      // Ignore incomplete/malformed SSE JSON.
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      handleLine(line);
    }
  }

  buffer += decoder.decode();

  for (const line of buffer.split("\n")) {
    handleLine(line);
  }

  return { chunks, finishReason };
}

export class GeminiProvider implements AIProvider {
  async stream(prompt: string): Promise<ReadableStream<Uint8Array>> {
    const config = getGeminiConfig();

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${config.modelId}:streamGenerateContent?alt=sse`;

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8192,
        // Gemini 3.x counts thinking tokens against maxOutputTokens.
        // This is a short structured-text task, so keep thinking minimal
        // to leave the budget for the actual 7-section report.
        thinkingConfig: {
          thinkingLevel: "LOW",
        },
      },
    };

    // Gemini sometimes drops the connection mid-generation under rate
    // limiting: the stream just ends with no finishReason at all, at a
    // random point (confirmed by direct testing against this endpoint —
    // identical requests fired back-to-back returned complete responses,
    // partial responses cut off after a few tokens, and everything in
    // between, purely based on request spacing). That's indistinguishable
    // from a normal chunk boundary until the stream actually ends, so each
    // attempt is buffered fully (collectGeminiStream) and only forwarded
    // once Gemini has reported an actual finishReason. Attempts that end
    // without one are discarded and retried from scratch.
    const maxStreamAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxStreamAttempts; attempt++) {
      const response = await fetchGeminiStream(
        endpoint,
        config.apiKey,
        requestBody
      );

      const { chunks, finishReason } = await collectGeminiStream(response);

      if (finishReason) {
        return new ReadableStream<Uint8Array>({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(chunk);
            }
            controller.close();
          },
        });
      }

      lastError = new Error(
        "Gemini stream ended before completion (no finishReason) — likely transient rate limiting"
      );

      if (attempt < maxStreamAttempts - 1) {
        // Empirically, retrying within a few seconds fails again — this
        // is a short per-minute quota window, not a one-off blip. A 45s
        // gap reliably succeeded in testing; a few-second backoff did not.
        const delay = (attempt + 1) * 15000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error("Gemini stream failed after retries");
  }
}

/* -------------------------------------------------------------------------- */
/* Watsonx Provider                                                           */
/* -------------------------------------------------------------------------- */

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

const TOKEN_TTL_MS = 50 * 60 * 1000;

const IAM_TOKEN_URL =
  "https://iam.cloud.ibm.com/identity/token";

async function getIAMToken(
  apiKey: string
): Promise<string> {
  const now = Date.now();

  if (
    tokenCache &&
    tokenCache.expiresAt > now
  ) {
    return tokenCache.accessToken;
  }

  const response = await fetch(
    IAM_TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ibm:params:oauth:grant-type:apikey",
        apikey: apiKey,
      }),
    }
  );

  if (!response.ok) {
    const body = await response
      .text()
      .catch(() => "(no body)");

    throw new Error(
      `IAM token exchange failed: HTTP ${response.status} — ${body}`
    );
  }

  const data =
    (await response.json()) as {
      access_token: string;
    };

  if (!data.access_token) {
    throw new Error(
      "IAM token exchange returned no access_token"
    );
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt:
      now + TOKEN_TTL_MS,
  };

  return tokenCache.accessToken;
}

function getWatsonxConfig() {
  const apiKey =
    process.env.WATSONX_API_KEY;

  const projectId =
    process.env.WATSONX_PROJECT_ID;

  const modelId =
    process.env.WATSONX_MODEL_ID ??
    "ibm/granite-3-3-8b-instruct";

  const baseUrl =
    process.env.WATSONX_URL;

  const missing: string[] = [];

  if (!apiKey) {
    missing.push("WATSONX_API_KEY");
  }

  if (!projectId) {
    missing.push("WATSONX_PROJECT_ID");
  }

  if (!baseUrl) {
    missing.push("WATSONX_URL");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`
    );
  }

  return {
    apiKey: apiKey!,
    projectId: projectId!,
    modelId,
    baseUrl:
      baseUrl!.replace(/\/$/, ""),
  };
}

export class WatsonxProvider
  implements AIProvider
{
  async stream(
    prompt: string
  ): Promise<ReadableStream<Uint8Array>> {
    const config =
      getWatsonxConfig();

    const token =
      await getIAMToken(
        config.apiKey
      );

    const endpoint =
      `${config.baseUrl}/ml/v1/text/generation_stream?version=2024-05-01`;

    const requestBody = {
      model_id:
        config.modelId,
      input: prompt,
      project_id:
        config.projectId,
      parameters: {
        max_new_tokens: 2000,
        temperature: 0.3,
        repetition_penalty: 1.1,
      },
    };

    const response =
      await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${token}`,
          "Content-Type":
            "application/json",
          Accept:
            "text/event-stream",
        },
        body: JSON.stringify(
          requestBody
        ),
      });

    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(() => "(no body)");

      throw new Error(
        `watsonx.ai API error: HTTP ${response.status} — ${body}`
      );
    }

    if (!response.body) {
      throw new Error(
        "watsonx.ai returned an empty response body"
      );
    }

    return response.body;
  }
}

/* -------------------------------------------------------------------------- */
/* Active Provider                                                            */
/* -------------------------------------------------------------------------- */

const provider =
  process.env.AI_PROVIDER?.toLowerCase() ??
  "watsonx";

export const aiProvider: AIProvider =
  provider === "gemini"
    ? new GeminiProvider()
    : new WatsonxProvider();