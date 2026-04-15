// @numera/ai — AI pipeline library

// Client
export {
  callClaude,
  callClaudeVision,
  parseJSONResponse,
  parseJSONArrayResponse,
  resetClient,
  AIError,
  MODEL_HAIKU,
  MODEL_SONNET,
} from './client.js';

export type { AIClientConfig, CallOptions, VisionCallOptions } from './client.js';

// Prompt functions
export { classifyEmail } from './prompts/classify-email.js';
export type { ClassifyEmailInput, ClassifyEmailResult } from './prompts/classify-email.js';

export { extractDocument, extractMultiPageDocument } from './prompts/extract-document.js';
export type {
  ExtractDocumentInput,
  ExtractedTransaction,
  ExtractionResult,
  MultiPageInput,
  PageImage,
  PageContext,
} from './prompts/extract-document.js';

export { categorizeTransaction } from './prompts/categorize-transaction.js';
export type {
  CategorizeTransactionInput,
  CategorizeTransactionResult,
  CategoryOption,
  CorrectionExample,
} from './prompts/categorize-transaction.js';

export { generateNarrative } from './prompts/generate-narrative.js';
export type {
  GenerateNarrativeInput,
  GenerateNarrativeResult,
  ReportSection,
} from './prompts/generate-narrative.js';

export { draftEmail } from './prompts/draft-email.js';
export type {
  DraftEmailInput,
  DraftEmailResult,
  ClientContext,
  InteractionContext,
  EmailTemplateType,
} from './prompts/draft-email.js';
