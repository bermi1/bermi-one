/*
  Who the app belongs to, in one place.

  These strings appear in the privacy policy, the terms, and the Play Console
  listing, and a store reviewer will try the contact address. Change them here
  before submission and they change everywhere — the legal pages read from this
  file rather than hard-coding a company that later moves.
*/

export const COMPANY = {
  /** Legal name of the operator. */
  name: 'Bermi Techs',
  /** The product. */
  product: 'Bermi One',
  /** Android application id. Must match capacitor.config.ts and build.gradle. */
  appId: 'one.bermi.app',
  /**
   * Where the web app lives. The Play listing's privacy-policy and data-deletion
   * URLs are built from this, so it has to be the real, live host.
   */
  site: 'https://bermione.app',
  /**
   * A mailbox a person actually reads. Play will email it, and so will clients
   * asking for their data to be deleted.
   */
  supportEmail: 'support@bermione.app',
  /** Where the business is registered. Names the law the terms are read under. */
  jurisdiction: 'Tanzania',
} as const;

export const LEGAL_UPDATED = '2026-09-19';
