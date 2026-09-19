// Inquiries: a client asking Bermi Techs something, and Bermi Techs answering.
//
// Both sides read and write the same two tables under row level security — a
// client sees only their own threads, staff see all of them. The status and the
// "who spoke last" flag are maintained by a database trigger rather than here,
// so a queue stays truthful however a message arrived.

import { supabase } from './supabase';

export type InquiryCategory = 'question' | 'problem' | 'billing' | 'feature' | 'data';
export type InquiryStatus = 'open' | 'answered' | 'resolved' | 'closed';

export interface Inquiry {
  id: string;
  business_id: string | null;
  owner_id: string;
  subject: string;
  category: InquiryCategory;
  status: InquiryStatus;
  priority: 'low' | 'normal' | 'high';
  business_name: string | null;
  owner_name: string | null;
  owner_email: string | null;
  last_message_at: string;
  awaiting: 'support' | 'client';
  created_at: string;
}

export interface InquiryMessage {
  id: string;
  inquiry_id: string;
  author_id: string | null;
  author_name: string | null;
  from_support: boolean;
  body: string;
  created_at: string;
}

export const CATEGORIES: { id: InquiryCategory; en: string; sw: string }[] = [
  { id: 'question', en: 'A question', sw: 'Swali' },
  { id: 'problem', en: 'Something is broken', sw: 'Kitu hakifanyi kazi' },
  { id: 'billing', en: 'Billing', sw: 'Malipo' },
  { id: 'data', en: 'My data', sw: 'Taarifa zangu' },
  { id: 'feature', en: 'An idea', sw: 'Wazo' },
];

export async function fetchMyInquiries(): Promise<Inquiry[]> {
  const { data } = await supabase
    .from('inquiries')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(50);
  return (data || []) as Inquiry[];
}

/** The console's queue: whatever is waiting on support, oldest wait first. */
export async function fetchSupportQueue(limit = 80): Promise<Inquiry[]> {
  const { data } = await supabase
    .from('inquiries')
    .select('*')
    .order('awaiting', { ascending: true })
    .order('last_message_at', { ascending: false })
    .limit(limit);
  return (data || []) as Inquiry[];
}

export async function fetchThread(inquiryId: string): Promise<InquiryMessage[]> {
  const { data } = await supabase
    .from('inquiry_messages')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true });
  return (data || []) as InquiryMessage[];
}

/**
 * Open a thread and post its first message together.
 *
 * The business, owner name and email are stamped onto the row rather than
 * joined later, so support can triage a queue without four lookups per line —
 * and so a thread still reads correctly after a business is renamed or deleted.
 */
export async function openInquiry(input: {
  ownerId: string;
  businessId: string | null;
  businessName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  subject: string;
  category: InquiryCategory;
  body: string;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('inquiries')
    .insert({
      owner_id: input.ownerId,
      business_id: input.businessId,
      business_name: input.businessName,
      owner_name: input.ownerName,
      owner_email: input.ownerEmail,
      subject: input.subject.trim(),
      category: input.category,
    })
    .select()
    .single();
  if (error || !data) return error?.message ?? 'Could not open the thread';

  const { error: msgError } = await supabase.from('inquiry_messages').insert({
    inquiry_id: data.id,
    author_id: input.ownerId,
    author_name: input.ownerName,
    from_support: false,
    body: input.body.trim(),
  });
  return msgError?.message ?? null;
}

export async function postMessage(input: {
  inquiryId: string;
  authorId: string;
  authorName: string | null;
  fromSupport: boolean;
  body: string;
}): Promise<string | null> {
  const { error } = await supabase.from('inquiry_messages').insert({
    inquiry_id: input.inquiryId,
    author_id: input.authorId,
    author_name: input.authorName,
    from_support: input.fromSupport,
    body: input.body.trim(),
  });
  return error?.message ?? null;
}

/** Support only — the policies refuse this from a client. */
export async function setInquiryStatus(inquiryId: string, status: InquiryStatus): Promise<string | null> {
  const { error } = await supabase.from('inquiries').update({ status }).eq('id', inquiryId);
  return error?.message ?? null;
}
