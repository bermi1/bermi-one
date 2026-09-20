// The portal speaks both languages too.
//
// Bermi Techs staff are Tanzanian; a console that only works in English is a
// console that half the team reads slowly. Kept separate from the tenant app's
// dictionary because the vocabulary is different — this one talks about
// accounts, tenants and ontology, none of which belong in a bar's interface.

import type { Lang } from '../lib/types';

export interface HqCopy {
  hq: string;
  hqSub: string;
  overview: string;
  clients: string;
  activity: string;
  ontology: string;
  payments: string;
  audit: string;
  inquiries: string;
  inquiriesSub: string;
  waitingOnUs: string;
  waitingOnThem: string;
  reply: string;
  markResolved: string;
  last30: string;
  salesTrend: string;
  closingsTrend: string;
  paying: string;
  ofAccounts: string;
  openThreads: string;
  messages: string;
  messagesSub: string;
  webhooks: string;
  webhooksSub: string;
  gateway: string;
  gatewayReady: string;
  gatewayNotReady: string;
  gatewayAppId: string;
  gatewaySecret: string;
  gatewayCallback: string;
  gatewayMode: string;
  gatewayRate: string;
  gatewayLive: string;
  gatewaySandbox: string;
  gatewayMissing: string;
  gatewayCallbackMissing: string;
  set: string;
  notSet: string;
  sent: string;
  queued: string;
  failedLabel: string;
  skipped: string;
  rejected: string;
  accepted: string;

  live: string;
  reconnecting: string;
  paused: string;
  refresh: string;
  loading: string;
  nothingYet: string;
  search: string;
  backToApp: string;
  signedInAs: string;

  mrr: string;
  collected30: string;
  accounts: string;
  businesses: string;
  activeBusinesses: string;
  closings30: string;
  verified: string;
  onTrial: string;
  blocked: string;
  subscriptions: string;
  status: string;

  statusActive: string;
  statusTrial: string;
  statusPastDue: string;
  statusSuspended: string;
  statusCancelled: string;
  blockedTag: string;

  owner: string;
  plan: string;
  renews: string;
  lastSignIn: string;
  lastClosing: string;
  noClosingYet: string;
  businessesOnAccount: string;
  closingsOnFile: string;
  turnover30: string;

  markPaid: string;
  markPastDue: string;
  billingNumber: string;
  save: string;
  sendPrompt: string;
  sendReset: string;
  blockAccess: string;
  restoreAccess: string;
  accessBlocked: string;
  blockNote: string;
  blockReason: string;
  cancel: string;
  chargesAccount: string;

  objects: string;
  verbs: string;
  objectsSub: string;
  verbsSub: string;
  records: string;
  runsLast30: string;
  lastRun: string;
  neverRun: string;
  allObjects: string;

  whoDidWhat: string;
  auditSub: string;
  activitySub: string;
}

export const HQ: Record<Lang, HqCopy> = {
  en: {
    hq: 'Bermi Techs',
    hqSub: 'Control panel',
    overview: 'Overview',
    clients: 'Clients',
    activity: 'Activity',
    ontology: 'Ontology',
    payments: 'Payments',
    audit: 'Audit',
    inquiries: 'Inquiries',
    inquiriesSub: 'What clients have asked, and what is still waiting on an answer.',
    waitingOnUs: 'Waiting on us', waitingOnThem: 'Waiting on them',
    reply: 'Reply', markResolved: 'Mark resolved',
    last30: 'Last 30 days', salesTrend: 'Sales across the platform', closingsTrend: 'Closings a day',
    paying: 'Paying', ofAccounts: 'of accounts', openThreads: 'Open threads',
    messages: 'Messages',
    messagesSub: 'SMS and email the platform has sent on a client\'s behalf, and anything still waiting.',
    webhooks: 'Webhooks',
    webhooksSub: 'Every callback Payme Africa sent, including the ones we turned away.',
    gateway: 'Payment gateway',
    gatewayReady: 'Ready to take payments',
    gatewayNotReady: 'Payments cannot complete',
    gatewayAppId: 'App ID', gatewaySecret: 'App secret', gatewayCallback: 'Callback URL',
    gatewayMode: 'Mode', gatewayRate: 'USD rate',
    gatewayLive: 'Live', gatewaySandbox: 'Sandbox',
    gatewayMissing: 'Set the missing secrets in Supabase → Edge Functions → Secrets.',
    gatewayCallbackMissing: 'Without a callback URL the gateway has nowhere to report to, so every charge stays pending for ever.',
    set: 'set', notSet: 'not set',
    sent: 'Sent', queued: 'Queued', failedLabel: 'Failed', skipped: 'Skipped',
    rejected: 'Rejected', accepted: 'Accepted',

    live: 'Live',
    reconnecting: 'Reconnecting',
    paused: 'Paused',
    refresh: 'Refresh',
    loading: 'Loading',
    nothingYet: 'Nothing here yet.',
    search: 'Search client, owner or city',
    backToApp: 'Back to the app',
    signedInAs: 'Signed in as',

    mrr: 'Monthly recurring',
    collected30: 'Collected, 30 days',
    accounts: 'Accounts',
    businesses: 'Businesses',
    activeBusinesses: 'active',
    closings30: 'Closings, 30 days',
    verified: 'Verified',
    onTrial: 'On trial',
    blocked: 'Blocked',
    subscriptions: 'Subscriptions',
    status: 'Status',

    statusActive: 'Active',
    statusTrial: 'Trial',
    statusPastDue: 'Past due',
    statusSuspended: 'Suspended',
    statusCancelled: 'Cancelled',
    blockedTag: 'Blocked',

    owner: 'Owner',
    plan: 'Plan',
    renews: 'Renews',
    lastSignIn: 'Last sign in',
    lastClosing: 'Last closing',
    noClosingYet: 'No closing yet',
    businessesOnAccount: 'Businesses on this account',
    closingsOnFile: 'Closings on file',
    turnover30: 'Turnover, last 30',

    markPaid: 'Mark paid · 30 days',
    markPastDue: 'Mark past due',
    billingNumber: 'Billing number',
    save: 'Save',
    sendPrompt: 'Send payment prompt',
    sendReset: 'Send password reset',
    blockAccess: 'Block access',
    restoreAccess: 'Restore access',
    accessBlocked: 'Access is blocked',
    blockNote: 'A blocked client can still read and export everything they own. They cannot record anything new until this is lifted.',
    blockReason: 'Reason the client will see',
    cancel: 'Cancel',
    chargesAccount: 'Charges the whole account once, not each business.',

    objects: 'Objects',
    verbs: 'Verbs',
    objectsSub: 'The nouns the platform is made of, and how many exist right now.',
    verbsSub: 'The verbs actually running, over the last 30 days.',
    records: 'records',
    runsLast30: 'runs, 30 days',
    lastRun: 'Last run',
    neverRun: 'Not used yet',
    allObjects: 'All objects',

    whoDidWhat: 'Who did what',
    auditSub: 'Every action Bermi Techs staff have taken on a client account. Written by the database, not the app.',
    activitySub: 'Every action across every tenant, as it happens.',
  },

  sw: {
    hq: 'Bermi Techs',
    hqSub: 'Kidhibiti cha mfumo',
    overview: 'Muhtasari',
    clients: 'Wateja',
    activity: 'Matukio',
    ontology: 'Ontolojia',
    payments: 'Malipo',
    audit: 'Ukaguzi',
    inquiries: 'Maswali',
    inquiriesSub: 'Wateja wameuliza nini, na nini bado kinasubiri jibu.',
    waitingOnUs: 'Yanatusubiri', waitingOnThem: 'Yanawasubiri',
    reply: 'Jibu', markResolved: 'Weka kama limetatuliwa',
    last30: 'Siku 30 zilizopita', salesTrend: 'Mauzo kwenye mfumo mzima', closingsTrend: 'Kufunga kwa siku',
    paying: 'Wanaolipa', ofAccounts: 'ya akaunti', openThreads: 'Maswali wazi',
    messages: 'Ujumbe',
    messagesSub: 'SMS na barua pepe ambazo mfumo umetuma kwa niaba ya mteja, na zinazosubiri.',
    webhooks: 'Webhooks',
    webhooksSub: 'Kila majibu Payme Africa waliyotuma, pamoja na yale tuliyokataa.',
    gateway: 'Lango la malipo',
    gatewayReady: 'Tayari kupokea malipo',
    gatewayNotReady: 'Malipo hayawezi kukamilika',
    gatewayAppId: 'App ID', gatewaySecret: 'Siri ya app', gatewayCallback: 'Callback URL',
    gatewayMode: 'Hali', gatewayRate: 'Kiwango cha USD',
    gatewayLive: 'Halisi', gatewaySandbox: 'Majaribio',
    gatewayMissing: 'Weka siri zinazokosekana Supabase → Edge Functions → Secrets.',
    gatewayCallbackMissing: 'Bila callback URL lango halina pa kuripoti, hivyo kila malipo yatabaki yanasubiri milele.',
    set: 'imewekwa', notSet: 'haijawekwa',
    sent: 'Imetumwa', queued: 'Inasubiri', failedLabel: 'Imeshindikana', skipped: 'Imerukwa',
    rejected: 'Imekataliwa', accepted: 'Imepokelewa',

    live: 'Moja kwa moja',
    reconnecting: 'Inaunganisha tena',
    paused: 'Imesimama',
    refresh: 'Onyesha upya',
    loading: 'Inapakia',
    nothingYet: 'Hakuna kitu bado.',
    search: 'Tafuta mteja, mmiliki au mji',
    backToApp: 'Rudi kwenye programu',
    signedInAs: 'Umeingia kama',

    mrr: 'Mapato ya kila mwezi',
    collected30: 'Zilizokusanywa, siku 30',
    accounts: 'Akaunti',
    businesses: 'Biashara',
    activeBusinesses: 'hai',
    closings30: 'Kufunga, siku 30',
    verified: 'Zimethibitishwa',
    onTrial: 'Kwenye majaribio',
    blocked: 'Zimezuiwa',
    subscriptions: 'Vifurushi',
    status: 'Hali',

    statusActive: 'Hai',
    statusTrial: 'Majaribio',
    statusPastDue: 'Imechelewa',
    statusSuspended: 'Imesimamishwa',
    statusCancelled: 'Imesitishwa',
    blockedTag: 'Imezuiwa',

    owner: 'Mmiliki',
    plan: 'Kifurushi',
    renews: 'Inaisha',
    lastSignIn: 'Aliingia mwisho',
    lastClosing: 'Kufunga kwa mwisho',
    noClosingYet: 'Hakuna kufunga bado',
    businessesOnAccount: 'Biashara kwenye akaunti hii',
    closingsOnFile: 'Kufunga kulikohifadhiwa',
    turnover30: 'Mauzo, siku 30',

    markPaid: 'Weka kama imelipwa · siku 30',
    markPastDue: 'Weka kama imechelewa',
    billingNumber: 'Namba ya malipo',
    save: 'Hifadhi',
    sendPrompt: 'Tuma ombi la malipo',
    sendReset: 'Tuma kiungo cha nenosiri',
    blockAccess: 'Zuia matumizi',
    restoreAccess: 'Rudisha matumizi',
    accessBlocked: 'Matumizi yamezuiwa',
    blockNote: 'Mteja aliyezuiwa bado anaweza kusoma na kutoa taarifa zake zote. Hawezi kurekodi kipya mpaka izuiliwe.',
    blockReason: 'Sababu ambayo mteja ataiona',
    cancel: 'Ghairi',
    chargesAccount: 'Inatoza akaunti nzima mara moja, si kila biashara.',

    objects: 'Vitu',
    verbs: 'Vitendo',
    objectsSub: 'Vitu ambavyo mfumo umejengwa navyo, na vingapi vipo sasa.',
    verbsSub: 'Vitendo vinavyotumika kweli, katika siku 30 zilizopita.',
    records: 'rekodi',
    runsLast30: 'mara, siku 30',
    lastRun: 'Mwisho',
    neverRun: 'Hakijatumika bado',
    allObjects: 'Vitu vyote',

    whoDidWhat: 'Nani alifanya nini',
    auditSub: 'Kila hatua wafanyakazi wa Bermi Techs wamechukua kwenye akaunti ya mteja. Imeandikwa na hifadhidata, si programu.',
    activitySub: 'Kila tukio kwa kila mteja, linapotokea.',
  },
};
