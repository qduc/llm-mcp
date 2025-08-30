import { z } from 'zod';

const BaseAskSchema = z.object({
  question: z.string(),
  model: z.string().optional(),
  tools: z.any().optional(),
  session_id: z.string().optional().default('default'),
});

export const AskGPTSchema = BaseAskSchema.extend({ model: z.string().optional().default('gpt-5') });
export const AskClaudeSchema = BaseAskSchema.extend({ model: z.string().optional().default('claude-sonnet-4-20250514') });
export const AskGeminiSchema = BaseAskSchema.extend({ model: z.string().optional().default('gemini-2.5-flash') });
export const AskOpenRouterSchema = BaseAskSchema.extend({ model: z.string().optional().default('qwen/qwen3-235b-a22b-07-25') });
export const ClearConversationSchema = z.object({ session_id: z.string().optional().default('default') });
// DeepSeek uses the same shape as AskOpenRouterSchema
export const AskDeepSeekSchema = AskOpenRouterSchema;
