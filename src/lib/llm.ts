// Pluggable LLM adapter.
//
// The whole app talks to the LLM only through `complete(prompt, options)` here.
// The default provider is local Ollama (free, runs on your machine). To swap in
// any other free HTTP LLM, implement `LlmProvider` and return it from
// `selectProvider()` — nothing else in the codebase needs to change.
//
// Ollama is NOT a hard dependency: `safeComplete()` degrades gracefully to a
// caller-supplied fallback when Ollama isn't running or the model isn't pulled,
// so the app and worker never crash just because the LLM is unavailable.
import { config } from "./config";

export interface CompleteOptions {
  /** Optional system prompt to steer tone/role. */
  system?: string;
  /** 0–1; higher = more creative. Defaults to 0.7. */
  temperature?: number;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export interface LlmProvider {
  readonly name: string;
  complete(prompt: string, options?: CompleteOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}

class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  async complete(prompt: string, options: CompleteOptions = {}): Promise<string> {
    const messages = [
      ...(options.system ? [{ role: "system", content: options.system }] : []),
      { role: "user", content: prompt },
    ];

    let res: Response;
    try {
      res = await fetch(`${config.OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.OLLAMA_MODEL,
          messages,
          stream: false,
          options: { temperature: options.temperature ?? 0.7 },
        }),
      });
    } catch (err) {
      throw new LlmUnavailableError(
        `Cannot reach Ollama at ${config.OLLAMA_HOST}. Is it running? ` +
          `Start Ollama, then run: ollama pull ${config.OLLAMA_MODEL}. ` +
          `(${err instanceof Error ? err.message : String(err)})`,
      );
    }

    if (res.status === 404) {
      throw new LlmUnavailableError(
        `Ollama model "${config.OLLAMA_MODEL}" is not installed. Run: ollama pull ${config.OLLAMA_MODEL}`,
      );
    }
    if (!res.ok) {
      throw new LlmUnavailableError(`Ollama returned ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() ?? "";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${config.OLLAMA_HOST}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}

function selectProvider(): LlmProvider {
  switch (config.LLM_PROVIDER.toLowerCase()) {
    case "ollama":
      return new OllamaProvider();
    // Add other free providers here, e.g.:
    // case "groq": return new GroqProvider();
    default:
      console.warn(`Unknown LLM_PROVIDER "${config.LLM_PROVIDER}"; falling back to Ollama.`);
      return new OllamaProvider();
  }
}

export const llm = selectProvider();

/** Primary entry point. Throws LlmUnavailableError if the provider can't be reached. */
export function complete(prompt: string, options?: CompleteOptions): Promise<string> {
  return llm.complete(prompt, options);
}

/**
 * Never-throws variant. On any failure (LLM down, model not pulled, etc.) returns
 * the provided `fallback` text so callers can degrade to deterministic templates.
 */
export async function safeComplete(
  prompt: string,
  fallback: string,
  options?: CompleteOptions,
): Promise<{ text: string; usedLlm: boolean; error?: string }> {
  try {
    const text = await llm.complete(prompt, options);
    return { text: text || fallback, usedLlm: text.length > 0 };
  } catch (err) {
    return {
      text: fallback,
      usedLlm: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
