import { z } from 'zod';
import { callClaude, parseJSONResponse, AIError, MODEL_SONNET } from '../client.js';
import type { AIClientConfig } from '../client.js';

// ─── Input / Output types ────────────────────────────────────────────────────

export type EmailTemplateType = 'document_request' | 'deadline_reminder' | 'report_delivery' | 'custom';

export interface ClientContext {
  businessName: string;
  contactName: string;
  contactEmail: string;
  industry: string;
}

export interface InteractionContext {
  recentDocuments?: string[];
  pendingDeadlines?: Array<{ type: string; dueDate: string; period: string }>;
  lastContactDate?: string;
}

export interface DraftEmailInput {
  client: ClientContext;
  interaction?: InteractionContext;
  templateType: EmailTemplateType;
  customIntent?: string;
}

const draftEmailResponseSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export type DraftEmailResult = z.infer<typeof draftEmailResponseSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(input: DraftEmailInput): string {
  const { client, interaction, templateType, customIntent } = input;

  let contextBlock = '';

  if (interaction?.recentDocuments && interaction.recentDocuments.length > 0) {
    contextBlock += `\nRecent documents received:\n${interaction.recentDocuments.map((d) => `- ${d}`).join('\n')}`;
  }

  if (interaction?.pendingDeadlines && interaction.pendingDeadlines.length > 0) {
    contextBlock += `\nPending deadlines:\n${interaction.pendingDeadlines.map((d) => `- ${d.type} (${d.period}): due ${d.dueDate}`).join('\n')}`;
  }

  if (interaction?.lastContactDate) {
    contextBlock += `\nLast contact: ${interaction.lastContactDate}`;
  }

  const intentLine = templateType === 'custom' && customIntent
    ? `\nCustom intent: ${customIntent}`
    : '';

  return `You are drafting a professional follow-up email for a Philippine accounting firm. The tone should be warm, professional, and respectful.

Template type: ${templateType}
Client: ${client.businessName} (${client.industry})
Contact: ${client.contactName} (${client.contactEmail})
${contextBlock}${intentLine}

Draft a short, professional email. Use Filipino-English business tone. Include a greeting and sign-off. Do not include any placeholder brackets — use the actual client name.

Respond in JSON:
{
  "subject": "email subject line",
  "body": "full email body"
}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function draftEmail(
  input: DraftEmailInput,
  config: AIClientConfig = {},
): Promise<DraftEmailResult> {
  const prompt = buildPrompt(input);

  const raw = await callClaude(
    prompt,
    { model: MODEL_SONNET, maxTokens: 1024, timeout: 15_000 },
    config,
  );

  const parsed = parseJSONResponse(raw, 'draft-email');

  const result = draftEmailResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new AIError(
      `Draft email response validation failed: ${result.error.issues.map((i) => i.message).join(', ')}`,
      'PARSE_ERROR',
      false,
    );
  }

  return result.data;
}
