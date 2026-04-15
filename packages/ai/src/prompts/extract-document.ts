import { z } from 'zod';
import { callClaudeVision, parseJSONArrayResponse, AIError, MODEL_SONNET } from '../client.js';
import type { AIClientConfig } from '../client.js';

// ─── Input / Output types ────────────────────────────────────────────────────

export interface PageImage {
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

export interface PageContext {
  pageStart: number;
  pageEnd: number;
  totalPages: number;
  runningBalance?: string;
}

export interface ExtractDocumentInput {
  images: PageImage[];
  pageContext: PageContext;
  documentType?: string;
}

const extractedTransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.string(),
  type: z.enum(['credit', 'debit']),
  vendor: z.string().optional().default(''),
  pageNumber: z.number(),
  runningBalance: z.string().optional(),
});

export type ExtractedTransaction = z.infer<typeof extractedTransactionSchema>;

const extractionResponseSchema = z.object({
  transactions: z.array(extractedTransactionSchema),
  runningBalance: z.string().optional(),
  warnings: z.array(z.string()).optional().default([]),
});

export type ExtractionResult = z.infer<typeof extractionResponseSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(ctx: PageContext, documentType?: string): string {
  const pageRange = ctx.pageStart === ctx.pageEnd
    ? `page ${ctx.pageStart}`
    : `pages ${ctx.pageStart}-${ctx.pageEnd}`;

  const docTypeHint = documentType ? `\nDocument type: ${documentType}` : '';
  const balanceHint = ctx.runningBalance
    ? `\nPrevious page ended with balance: ${ctx.runningBalance}`
    : '';

  return `You are a financial document OCR specialist for Philippine SMB bookkeeping. Extract all transactions from the attached document image(s).

This is ${pageRange} of a ${ctx.totalPages}-page document.${docTypeHint}${balanceHint}

For each transaction found, extract:
- date: the transaction date in YYYY-MM-DD format
- description: the transaction description as shown on the document
- amount: the amount as a decimal string (e.g. "1500.00")
- type: "credit" or "debit"
- vendor: the vendor/payee name if identifiable, otherwise empty string
- pageNumber: which page this transaction appears on
- runningBalance: the running balance shown after this transaction, if visible

Also extract the final running balance visible on the last page of this batch.

Respond in JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": "string",
      "type": "credit" | "debit",
      "vendor": "string",
      "pageNumber": number,
      "runningBalance": "string or omit"
    }
  ],
  "runningBalance": "final running balance or omit",
  "warnings": ["any issues encountered"]
}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function extractDocument(
  input: ExtractDocumentInput,
  config: AIClientConfig = {},
): Promise<ExtractionResult> {
  const prompt = buildPrompt(input.pageContext, input.documentType);

  const raw = await callClaudeVision(
    prompt,
    {
      model: MODEL_SONNET,
      maxTokens: 4096,
      timeout: 120_000,
      images: input.images,
    },
    config,
  );

  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      const transactions = parseJSONArrayResponse(raw, 'extract-document');
      parsed = { transactions, warnings: [] };
    }
  } catch {
    throw new AIError('Failed to parse extraction response', 'PARSE_ERROR', false);
  }

  const result = extractionResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIError(
      `Extraction response validation failed: ${result.error.issues.map((i) => i.message).join(', ')}`,
      'PARSE_ERROR',
      false,
    );
  }

  return result.data;
}

// ─── Multi-page orchestration ────────────────────────────────────────────────

const MAX_PAGES_PER_BATCH = 3;

export interface MultiPageInput {
  pages: PageImage[];
  documentType?: string;
}

export async function extractMultiPageDocument(
  input: MultiPageInput,
  config: AIClientConfig = {},
): Promise<ExtractionResult> {
  const { pages, documentType } = input;
  const totalPages = pages.length;
  const allTransactions: ExtractedTransaction[] = [];
  const allWarnings: string[] = [];
  let runningBalance: string | undefined;

  for (let i = 0; i < totalPages; i += MAX_PAGES_PER_BATCH) {
    const batchPages = pages.slice(i, i + MAX_PAGES_PER_BATCH);
    const pageStart = i + 1;
    const pageEnd = i + batchPages.length;

    const result = await extractDocument(
      {
        images: batchPages,
        pageContext: { pageStart, pageEnd, totalPages, runningBalance },
        documentType,
      },
      config,
    );

    allTransactions.push(...result.transactions);
    allWarnings.push(...(result.warnings ?? []));
    runningBalance = result.runningBalance ?? runningBalance;
  }

  const deduped = deduplicatePageBoundaryTransactions(allTransactions);

  return {
    transactions: deduped,
    runningBalance,
    warnings: allWarnings,
  };
}

function deduplicatePageBoundaryTransactions(transactions: ExtractedTransaction[]): ExtractedTransaction[] {
  if (transactions.length <= 1) return transactions;

  const result: ExtractedTransaction[] = [transactions[0]!];

  for (let i = 1; i < transactions.length; i++) {
    const prev = transactions[i - 1]!;
    const curr = transactions[i]!;

    const isBoundary = curr.pageNumber !== prev.pageNumber;
    if (isBoundary && curr.date === prev.date && curr.amount === prev.amount && levenshtein(curr.description, prev.description) <= 3) {
      continue;
    }

    result.push(curr);
  }

  return result;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0) as number[]);

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1]
        ? dp[i - 1]![j - 1]!
        : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }

  return dp[m]![n]!;
}
