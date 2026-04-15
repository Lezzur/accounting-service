import { z } from 'zod';
import { callClaude, parseJSONResponse, AIError, MODEL_SONNET } from '../client.js';
import type { AIClientConfig } from '../client.js';
import type { ReportType } from '@numera/db';

// ─── Input / Output types ────────────────────────────────────────────────────

export interface ReportSection {
  title: string;
  items: Array<{ code: string; name: string; amount: string }>;
  total: string;
}

export interface GenerateNarrativeInput {
  reportType: ReportType;
  periodStart: string;
  periodEnd: string;
  sections: ReportSection[];
  totals: Record<string, string>;
}

const narrativeResponseSchema = z.object({
  narrative: z.string(),
});

export type GenerateNarrativeResult = z.infer<typeof narrativeResponseSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

function formatReportType(type: ReportType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPrompt(input: GenerateNarrativeInput): string {
  const formattedType = formatReportType(input.reportType);

  const keyFigures = input.sections
    .map((s) => {
      const items = s.items.map((i) => `  ${i.name}: ₱${i.amount}`).join('\n');
      return `${s.title}:\n${items}\n  Total: ₱${s.total}`;
    })
    .join('\n\n');

  const totalsBlock = Object.entries(input.totals)
    .map(([k, v]) => `${k}: ₱${v}`)
    .join('\n');

  return `Generate a brief professional financial summary (3-5 sentences) for a ${formattedType} for the period ${input.periodStart} to ${input.periodEnd}.

Key figures:
${keyFigures}

${totalsBlock}

Write in third person. Focus on: revenue trends, major expense categories, net income, and any notable items. Do not invent data not provided. Label clearly as "AI-Generated Summary — Review before sharing with client."

Respond in JSON:
{
  "narrative": "your summary text here"
}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function generateNarrative(
  input: GenerateNarrativeInput,
  config: AIClientConfig = {},
): Promise<GenerateNarrativeResult> {
  const prompt = buildPrompt(input);

  const raw = await callClaude(
    prompt,
    { model: MODEL_SONNET, maxTokens: 1024, timeout: 30_000 },
    config,
  );

  const parsed = parseJSONResponse(raw, 'generate-narrative');

  const result = narrativeResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIError(
      `Narrative response validation failed: ${result.error.issues.map((i) => i.message).join(', ')}`,
      'PARSE_ERROR',
      false,
    );
  }

  return result.data;
}
