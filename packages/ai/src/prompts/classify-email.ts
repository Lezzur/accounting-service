import { z } from 'zod';
import { callClaude, parseJSONResponse, AIError, MODEL_HAIKU } from '../client.js';
import type { AIClientConfig } from '../client.js';

// ─── Input / Output types ────────────────────────────────────────────────────

export interface ClassifyEmailInput {
  gmailMessageId: string;
  senderEmail: string;
  senderName: string;
  subject: string;
  snippet: string;
  hasAttachments: boolean;
  attachmentNames: string[];
  matchedClientId: string | null;
}

const classifyEmailResponseSchema = z.object({
  isDocument: z.boolean(),
  documentType: z
    .enum([
      'receipt',
      'bank_statement',
      'invoice',
      'credit_card_statement',
      'expense_report',
      'payroll_data',
      'other',
    ])
    .nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type ClassifyEmailResult = z.infer<typeof classifyEmailResponseSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(input: ClassifyEmailInput): string {
  return `You are an email classifier for an accounting firm. Determine if this email contains a financial document (receipt, bank statement, invoice, credit card statement, expense report, or payroll data).

Sender: ${input.senderEmail} (${input.senderName})
Subject: ${input.subject}
Preview: ${input.snippet}
Attachments: ${input.attachmentNames.length > 0 ? input.attachmentNames.join(', ') : 'None'}
Known client: ${input.matchedClientId ? 'yes' : 'no'}

Respond in JSON:
{
  "isDocument": boolean,
  "documentType": "receipt" | "bank_statement" | "invoice" | "credit_card_statement" | "expense_report" | "payroll_data" | "other" | null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function classifyEmail(
  input: ClassifyEmailInput,
  config: AIClientConfig = {},
): Promise<ClassifyEmailResult> {
  const prompt = buildPrompt(input);

  let raw: string;
  try {
    raw = await callClaude(prompt, { model: MODEL_HAIKU, maxTokens: 256, timeout: 30_000 }, config);
  } catch (err) {
    // API failure → fail-open: treat as unprocessed so accountant reviews manually
    return {
      isDocument: false,
      documentType: null,
      confidence: 0,
      reasoning: err instanceof AIError ? `Classification failed: ${err.code}` : 'Classification failed: unknown error',
    };
  }

  let parsed: unknown;
  try {
    parsed = parseJSONResponse(raw, 'classify-email');
  } catch {
    // Malformed JSON → fail-open
    return {
      isDocument: false,
      documentType: null,
      confidence: 0,
      reasoning: 'Malformed JSON response from classifier',
    };
  }

  const result = classifyEmailResponseSchema.safeParse(parsed);
  if (!result.success) {
    return {
      isDocument: false,
      documentType: null,
      confidence: 0,
      reasoning: 'Response failed schema validation',
    };
  }

  return result.data;
}
