/**
 * Pricing formatting utilities for LLM token costs.
 * Converts raw per-token costs (as returned by OpenRouter API, e.g. 0.000003)
 * into standard human-readable pricing per 1 Million tokens ($/1M tokens).
 */

export interface FormattedModelPricing {
  isFree: boolean;
  promptPricePerMillion: number;
  completionPricePerMillion: number;
  promptFormatted: string;
  completionFormatted: string;
  summary: string;
  shortBadge: string;
}

/**
 * Formats a raw per-token price in USD into a clean string per 1 Million tokens.
 * e.g.:
 *  - 0.000003 -> "$3/M"
 *  - 0.000015 -> "$15/M"
 *  - 0.0000025 -> "$2.50/M"
 *  - 0.00000015 -> "$0.15/M"
 *  - 0.00000005 -> "$0.05/M"
 *  - 0.000000005 -> "$0.005/M"
 *  - 0 -> "$0"
 */
export function formatPricePerMillion(pricePerToken?: number): string {
  if (pricePerToken === undefined || pricePerToken === null || pricePerToken <= 0) {
    return "$0";
  }

  const perMillion = pricePerToken * 1_000_000;

  if (perMillion >= 100) {
    return `$${Math.round(perMillion)}`;
  }

  if (perMillion >= 1) {
    const formatted = perMillion.toFixed(2);
    return `$${formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted.replace(/\.?0+$/, "")}`;
  }

  if (perMillion >= 0.01) {
    const formatted = perMillion.toFixed(3);
    return `$${formatted.replace(/0+$/, "").replace(/\.$/, "")}`;
  }

  if (perMillion >= 0.0001) {
    const formatted = perMillion.toFixed(4);
    return `$${formatted.replace(/0+$/, "").replace(/\.$/, "")}`;
  }

  return `$${perMillion.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
}

/**
 * Checks whether a model is free based on its ID and pricing fields.
 */
export function isModelFree(modelId: string, inputPrice?: number, outputPrice?: number): boolean {
  if (modelId === "openrouter/free" || modelId.endsWith(":free")) {
    return true;
  }
  const inPrice = inputPrice ?? 0;
  const outPrice = outputPrice ?? 0;
  return inPrice === 0 && outPrice === 0;
}

/**
 * Formats full pricing information for a model.
 */
export function formatModelPricing(
  modelId: string,
  inputPrice?: number,
  outputPrice?: number
): FormattedModelPricing {
  const free = isModelFree(modelId, inputPrice, outputPrice);

  if (free) {
    return {
      isFree: true,
      promptPricePerMillion: 0,
      completionPricePerMillion: 0,
      promptFormatted: "$0",
      completionFormatted: "$0",
      summary: "$0 / Free Tier",
      shortBadge: "FREE",
    };
  }

  const inPrice = inputPrice ?? 0;
  const outPrice = outputPrice ?? 0;
  const promptPricePerMillion = inPrice * 1_000_000;
  const completionPricePerMillion = outPrice * 1_000_000;

  const promptFormatted = `${formatPricePerMillion(inPrice)}/M`;
  const completionFormatted = `${formatPricePerMillion(outPrice)}/M`;

  return {
    isFree: false,
    promptPricePerMillion,
    completionPricePerMillion,
    promptFormatted,
    completionFormatted,
    summary: `${promptFormatted} in · ${completionFormatted} out`,
    shortBadge: `${formatPricePerMillion(inPrice)}/M in`,
  };
}
