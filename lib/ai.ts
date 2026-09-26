/**
 * lib/ai.ts — AI provider abstraction for DevChange AI
 *
 * Defines the AIProvider interface and implements WatsonxProvider,
 * which calls the IBM watsonx.ai text generation streaming endpoint
 * via plain fetch + ReadableStream. No Vercel AI SDK dependency.
 *
 * To swap providers: change the single `export const aiProvider` line.
 */

// ─── Provider Interface ───────────────────────────────────────────────────────

/**
 * Minimal interface every AI provider must satisfy.
 * stream() returns the raw ReadableStream from the upstream API so the
 * route handler can pipe it directly to the browser.
 */
export interface AIProvider {
  stream(prompt: string): Promise<ReadableStream<Uint8Array>>;
}

// ─── IAM Token Cache ──────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  /** Unix timestamp (ms) after which the token must be refreshed */
  expiresAt: number;
}

// Module-level cache — persists for the lifetime of the serverless function
// instance. Safe for Vercel's single-request cold-start model.
let tokenCache: TokenCache | null = null;

/** IAM tokens are valid for 3600 s. We refresh 10 min early → 50-min TTL. */
const TOKEN_TTL_MS = 50 * 60 * 1000;
const IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";

/**
 * Exchange an IBM Cloud API key for a Bearer access token.
 * Returns a cached token if it has not expired yet.
 */
async function getIAMToken(apiKey: string): Promise<string> {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.accessToken;
  }

  const response = await fetch(IAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(
      `IAM token exchange failed: HTTP ${response.status} — ${body}`
    );
  }

  const data = (await response.json()) as { access_token: string };

  if (!data.access_token) {
    throw new Error("IAM token exchange returned no access_token");
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + TOKEN_TTL_MS,
  };

  return tokenCache.accessToken;
}

// ─── WatsonxProvider ─────────────────────────────────────────────────────────

/**
 * Configuration read once from environment variables at construction time.
 * Throws clearly if any required variable is missing.
 */
function getWatsonxConfig() {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const modelId =
    process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-3-8b-instruct";
  const baseUrl = process.env.WATSONX_URL;

  const missing: string[] = [];
  if (!apiKey) missing.push("WATSONX_API_KEY");
  if (!projectId) missing.push("WATSONX_PROJECT_ID");
  if (!baseUrl) missing.push("WATSONX_URL");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}`
    );
  }

  return {
    apiKey: apiKey!,
    projectId: projectId!,
    modelId,
    baseUrl: baseUrl!.replace(/\/$/, ""), // strip trailing slash
  };
}

/**
 * Implements AIProvider using the IBM watsonx.ai text generation streaming
 * endpoint. Returns the raw response.body so the route handler can pipe it
 * directly to the browser without buffering.
 *
 * Endpoint: POST {baseUrl}/ml/v1/text/generation_stream?version=2024-05-01
 * Auth:     IBM IAM Bearer token (exchanged from API key, cached 50 min)
 * Format:   application/json request body; text/event-stream SSE response
 */
export class WatsonxProvider implements AIProvider {
  async stream(prompt: string): Promise<ReadableStream<Uint8Array>> {
    const config = getWatsonxConfig();
    const token = await getIAMToken(config.apiKey);

    const endpoint = `${config.baseUrl}/ml/v1/text/generation_stream?version=2024-05-01`;

    const requestBody = {
      model_id: config.modelId,
      input: prompt,
      project_id: config.projectId,
      parameters: {
        max_new_tokens: 2000,
        temperature: 0.3,
        repetition_penalty: 1.1,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "(no body)");
      throw new Error(
        `watsonx.ai API error: HTTP ${response.status} — ${body}`
      );
    }

    if (!response.body) {
      throw new Error("watsonx.ai returned an empty response body");
    }

    return response.body;
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

/**
 * The active AI provider used by all API routes.
 * To swap providers: replace `new WatsonxProvider()` with another implementation.
 */
export const aiProvider: AIProvider = new WatsonxProvider();
