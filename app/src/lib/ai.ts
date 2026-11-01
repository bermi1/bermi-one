import { invokeFunction } from './functions';

export type AiTurn = { role: 'user' | 'assistant'; text: string };
/** Why the real model did not answer; the app then answers with its built-in assistant. */
export type AiFallback = 'NOT_PREMIUM' | 'NOT_BAR' | 'NO_KEY' | 'LIMIT' | 'BUSY' | 'REFUSED' | 'EMPTY' | 'AI_ERROR';

/** Ask Bermi AI (Claude) about this business. Never throws: a failure is a fallback code. */
export async function askAi(businessId: string, question: string, history: AiTurn[]): Promise<{ answer?: string; fallback?: AiFallback; remaining?: number }> {
  try {
    return await invokeFunction<{ answer?: string; fallback?: AiFallback; remaining?: number }>('ask-ai', { business_id: businessId, question, history });
  } catch {
    return { fallback: 'AI_ERROR' };
  }
}
