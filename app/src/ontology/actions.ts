import { supabase } from '../lib/supabase';
import { ACTION_TYPES, type ActionTypeName, type ObjectTypeName } from './schema';

export interface ActionLogEntry {
  id: string;
  business_id: string;
  object_type: ObjectTypeName;
  action_type: ActionTypeName;
  object_id: string | null;
  summary: string;
  payload: Record<string, unknown>;
  actor_name: string | null;
  created_at: string;
}

/**
 * The single sanctioned path for recording that a verb happened to a noun.
 * Every meaningful business mutation goes through here so Bermi AI (and,
 * later, any other reasoning) can work off a real history instead of a bare
 * snapshot of current state.
 */
export async function logAction(input: {
  businessId: string;
  actionType: ActionTypeName;
  objectId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
  actorName?: string | null;
}): Promise<ActionLogEntry | null> {
  const objectType = ACTION_TYPES[input.actionType].objectType;
  const { data } = await supabase
    .from('action_log')
    .insert({
      business_id: input.businessId,
      object_type: objectType,
      action_type: input.actionType,
      object_id: input.objectId ?? null,
      summary: input.summary,
      payload: input.payload ?? {},
      actor_name: input.actorName ?? null,
    })
    .select()
    .single();
  return (data as ActionLogEntry) ?? null;
}

export async function fetchRecentActions(businessId: string, limit = 40): Promise<ActionLogEntry[]> {
  const { data } = await supabase
    .from('action_log')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as ActionLogEntry[]) || [];
}

/**
 * Erase every trace of an object from the history.
 *
 * The action log is normally append-only — that is the whole point of it. This
 * is the one sanctioned exception: when a record is deleted permanently, the
 * log lines that describe it are part of that record. Leaving them behind
 * would mean a "permanently deleted" session still narrates its own sales
 * figures to anyone reading the history, or to Bermi AI.
 */
export async function purgeActions(businessId: string, objectIds: string[]): Promise<void> {
  const ids = objectIds.filter(Boolean);
  if (ids.length === 0) return;
  await supabase.from('action_log').delete().eq('business_id', businessId).in('object_id', ids);
}
