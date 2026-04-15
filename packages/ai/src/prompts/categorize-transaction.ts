import { z } from 'zod';
import { callClaude, parseJSONResponse, AIError, MODEL_HAIKU } from '../client.js';
import type { AIClientConfig } from '../client.js';

// ─── Input / Output types ────────────────────────────────────────────────────

export interface CategoryOption {
  code: string;
  name: string;
  type: string;
}

export interface CorrectionExample {
  original: string;
  corrected: string;
  description: string;
}

export interface CategorizeTransactionInput {
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  clientIndustry: string;
  existingCategories: CategoryOption[];
  recentCorrections?: CorrectionExample[];
}

const categorizeResponseSchema = z.object({
  categoryCode: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type CategorizeTransactionResult = z.infer<typeof categorizeResponseSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(input: CategorizeTransactionInput): string {
  const categoriesList = input.existingCategories
    .map((c) => `${c.code}: ${c.name} (${c.type})`)
    .join('\n');

  let correctionsBlock = '';
  if (input.recentCorrections && input.recentCorrections.length > 0) {
    const lines = input.recentCorrections
      .map((c) => `"${c.description}" was "${c.original}" → corrected to "${c.corrected}"`)
      .join('\n');
    correctionsBlock = `\nRecent corrections for similar transactions (learn from these):\n${lines}\n`;
  }

  return `You are a transaction categorizer for Philippine SMB bookkeeping. Assign the most appropriate chart of accounts category.

Transaction:
- Description: ${input.description}
- Amount: ₱${input.amount}
- Type: ${input.type}
- Client industry: ${input.clientIndustry}

Available categories:
${categoriesList}
${correctionsBlock}
Respond in JSON:
{
  "categoryCode": "string",
  "confidence": 0.0-1.0,
  "reasoning": "brief"
}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function categorizeTransaction(
  input: CategorizeTransactionInput,
  config: AIClientConfig = {},
): Promise<CategorizeTransactionResult> {
  const prompt = buildPrompt(input);

  const raw = await callClaude(prompt, { model: MODEL_HAIKU, maxTokens: 256, timeout: 30_000 }, config);

  const parsed = parseJSONResponse(raw, 'categorize-transaction');

  const result = categorizeResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIError(
      `Categorization response validation failed: ${result.error.issues.map((i) => i.message).join(', ')}`,
      'PARSE_ERROR',
      false,
    );
  }

  return result.data;
}
