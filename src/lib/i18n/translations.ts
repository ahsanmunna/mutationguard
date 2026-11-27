export type Language = 'bn' | 'en';

/**
 * Fictional demo persons dictionary for Bangla/English localization.
 * Hackathon rules: All data is dummy/fictional.
 */
export const BANGLA_NAMES: Record<string, string> = {
  'Farhan Ahmed (AC Land)': 'ফারহান আহমেদ (সহকারী কমিশনার ভূমি)',
  'Rahim Uddin': 'রহিম উদ্দিন',
  'Karim Chowdhury': 'করিম চৌধুরী',
  'Hasan Mahmud': 'হাসান মাহমুদ',
  'Abdul Maleque': 'আব্দুল মালেক',
  'Nasima Akter': 'নাসিমা আক্তার',
  'Shamsul Haque': 'শামসুল হক',
  'Tariqul Islam': 'তারিকুল ইসলাম',
  'Nasreen Akhtar': 'নাসরিন আক্তার',
  'Rafiqul Alam': 'রফিকুল আলম',
  'Zubair Hossain': 'জুবায়ের হোসেন',
  'MutationGuard System Audit': 'মিউটেশনগার্ড সিস্টেম অডিট',
  'Original State Allotment': 'মূল সরকারি বন্দোবস্ত',
  'Abul Kashem': 'আবুল কাশেম',
  'Altaf Hossain': 'আলতাফ হোসেন',
  'Anisur Rahman': 'আনিসুর রহমান',
  'Farida Begum': 'ফরিদা বেগম',
};

/**
 * Helper to display owner/seller/buyer names in Bangla when language is 'bn'.
 */
export function localName(name: string | undefined | null, lang: Language): string {
  if (!name) return '';
  if (lang === 'bn' && BANGLA_NAMES[name]) {
    return BANGLA_NAMES[name];
  }
  return name;
}

/**
 * Helper to convert English digits to Bengali digits.
 */
export function toBengaliDigits(input: string | number): string {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).replace(/[0-9]/g, (w) => bengaliDigits[+w]);
}

/**
 * Formats a decimal number with localized digits.
 */
export function formatNumber(val: number | string, lang: Language): string {
  const numStr = typeof val === 'number' ? val.toFixed(2) : String(val);
  return lang === 'bn' ? toBengaliDigits(numStr) : numStr;
}

/**
 * Formats a whole number (counts, block numbers, step numbers) with localized digits
 * and NO decimals. Use formatNumber() only for areas, which keep two decimals.
 */
export function formatCount(val: number | string, lang: Language): string {
  const numStr = String(val);
  return lang === 'bn' ? toBengaliDigits(numStr) : numStr;
}

/**
 * Formats a date string with localized digits.
 */
export function formatDate(dateStr: string, lang: Language): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const formatted = d.toISOString().split('T')[0];
    return lang === 'bn' ? toBengaliDigits(formatted) : formatted;
  } catch {
    return dateStr;
  }
}

/**
 * Formats an optional date value using formatDate, returning fallback ('—') when missing or empty.
 */
export function formatOptionalDate(
  value: string | Date | null | undefined,
  lang: Language,
  fallback = '—'
): string {
  if (value === null || value === undefined) return fallback;
  const raw =
    value instanceof Date
      ? Number.isNaN(value.getTime())
        ? ''
        : value.toISOString()
      : String(value).trim();
  if (!raw) return fallback;
  const formatted = formatDate(raw, lang);
  return formatted || fallback;
}

/**
 * Recognizes hyphenated domain identifiers such as P-001, TR-2026-0008, DEED-2026-001, NID-DEMO-0001.
 */
export function isIdentifier(value: string): boolean {
  return /^[A-Za-z]{1,10}(?:-[A-Za-z0-9]+)+$/.test(value.trim());
}

/**
 * Formats an identifier value for display while strictly preserving hyphens.
 */
export function formatIdentifier(value: string | number | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

export const translations = {
  bn: {
    app_title: 'মিউটেশনগার্ড',
    app_subtitle: 'ভূমি নামজারি ও দ্বৈত হস্তান্তর সনাক্তকরণ এবং অপরিবর্তনীয় অডিট ট্রেইল সিস্টেম',
    nav_home: 'হোম',
    nav_dashboard: 'পর্যালোচনা কিউ',
    nav_submit: 'নতুন নামজারি আবেদন',
    nav_integrity: 'অডিট নিরীক্ষা',
    nav_demo: 'ডেমো প্যানেল',
    nav_login: 'লগইন',
    nav_logout: 'লগআউট',
    role_label: 'বর্তমান ব্যবহারকারী:',
    switch_role: 'ব্যবহারকারী পরিবর্তন',
    lang_toggle: 'English',
    demo_badge: 'ডেমো সংস্করণ',
    demo_footer_note: 'সতর্কতা: এটি একটি পরীক্ষামূলক একাডেমিক প্রোটোটাইপ। সকল তথ্য কাল্পনিক।',
    status_submitted: 'দাখিলকৃত',
    status_verified: 'যাচাইকৃত',
    status_under_review: 'পর্যালোচনাধীন',
    status_approved: 'অনুমোদিত',
    status_finalized: 'চূড়ান্ত নিষ্পত্তিকৃত',
    status_held: 'স্থগিত',
    status_rejected: 'বাতিলকৃত',
    rules_double_sale: 'দ্বৈত হস্তান্তর সনাক্ত',
    rules_wrong_seller: 'অননুমোদিত বিক্রেতা',
    rules_record_mismatch: 'রেকর্ড অমিল',
    findings_title: 'স্বয়ংক্রিয় সনাক্তকরণ ফলাফল',
    no_findings: 'কোনো অসঙ্গতি বা বিরোধ পাওয়া যায়নি।',
    verify_title: 'পাবলিক সত্যতা যাচাইকরণ',
    qr_scan_instruction: 'এই কিউআর কোড স্ক্যান করে সরাসরি সরকারি রেকর্ড থেকে নামজারির সত্যতা নিশ্চিত করুন।',
    tamper_audit_title: 'ক্রিপ্টোগ্রাফিক চেইন ও অডিট লেজার',
    verify_chain_button: 'সম্পূর্ণ চেইনের সত্যতা যাচাই করুন',
    chain_valid: 'কোনো পরিবর্তন ধরা পড়েনি: অডিট চেইন ও দলিল মিলে গেছে।',
    chain_invalid: 'সতর্কতা! ডেটা বিকৃতি বা টেম্পারিং সনাক্ত হয়েছে!',
    demo_title: 'শিক্ষার্থী উপস্থাপনা ও ডেমো প্যানেল',
    demo_subtitle: 'ম্যানুয়াল ডাটাবেস পরিবর্তন ছাড়াই মূল্যায়ন পরিস্থিতি অনুশীলনের জন্য নিয়ন্ত্রিত প্যানেল।',
    demo_reset_btn: 'সকল তথ্য প্রাথমিক সিড অবস্থায় রিসেট করুন',
    demo_resetting: 'রিসেট হচ্ছে...',
    demo_concurrent_btn: 'একই সময়ে দুটি সংঘাতপূর্ণ অনুরোধ পাঠান',
    demo_concurrent_hint: 'পরামর্শ: এই পরীক্ষার সঠিক ফলাফলের জন্য প্রথমে উপরের বোতামে ক্লিক করে ডেটা রিসেট করুন যাতে P-001-এ কোনো সক্রিয় আবেদন না থাকে।',
    evidence_msg_double_sale: 'এই পার্সেলে ইতিমধ্যে একটি সক্রিয় হস্তান্তর চলমান রয়েছে; একই সাথে আরেকটি হস্তান্তর চলতে পারবে না।',
    evidence_msg_concurrent_double_sale: 'একই সময়ে আরেকটি হস্তান্তর দাখিল হয়েছে; বর্তমান আবেদনটি স্থগিত রাখা হয়েছে।',
    evidence_msg_wrong_seller: 'দলিলে উল্লিখিত বিক্রেতা রেজিস্ট্রি রেকর্ডের বর্তমান নিবন্ধিত মালিকের সাথে মেলেনি।',
    checkpoint_section_title: 'অডিট চেকপয়েন্ট',
    checkpoint_note: 'চেকপয়েন্টটি এই ডাটাবেসের বাইরে কোথাও সংরক্ষণ করুন। কপিটি যদি ডাটাবেসের সাথে একসাথে পরিবর্তন করা না যায়, কেবল তখনই এটি আপনাকে সুরক্ষা দেবে।',
    checkpoint_export_btn: 'চেকপয়েন্ট এক্সপোর্ট করুন',
    checkpoint_exporting: 'এক্সপোর্ট হচ্ছে...',
    checkpoint_verify_title: 'চেকপয়েন্টের সাথে যাচাই করুন',
    checkpoint_verify_btn: 'চেকপয়েন্টের সাথে যাচাই করুন',
    checkpoint_verifying: 'যাচাই চলছে...',
    checkpoint_match_title: 'MATCH — চেকপয়েন্ট মিলেছে',
    checkpoint_mismatch_title: 'MISMATCH — চেকপয়েন্টের সাথে মেলেনি',
    checkpoint_check_signature: 'স্বাক্ষর বৈধ',
    checkpoint_check_chain: 'চেইন বৈধ',
    checkpoint_check_head: 'হেড হ্যাশ মিলেছে',
    checkpoint_check_length: 'চেইন ছোট হয়নি',
  },
  en: {
    app_title: 'MutationGuard',
    app_subtitle: 'Land Mutation Conflict Detection & Tamper-Evident Audit Ledger',
    nav_home: 'Home',
    nav_dashboard: 'Review Queue',
    nav_submit: 'New Mutation',
    nav_integrity: 'Audit Integrity',
    nav_demo: 'Demo Panel',
    nav_login: 'Login',
    nav_logout: 'Logout',
    role_label: 'Current User:',
    switch_role: 'Switch User',
    lang_toggle: 'বাংলা',
    demo_badge: 'Demo Mode',
    demo_footer_note: 'Notice: This is an academic test prototype. All data is fictional.',
    status_submitted: 'Submitted',
    status_verified: 'Verified',
    status_under_review: 'Under Review',
    status_approved: 'Approved',
    status_finalized: 'Finalized',
    status_held: 'Held',
    status_rejected: 'Rejected',
    rules_double_sale: 'Double Sale Detected',
    rules_wrong_seller: 'Wrong Seller Detected',
    rules_record_mismatch: 'Record Mismatch Detected',
    findings_title: 'Automated Rule Findings',
    no_findings: 'No conflicting records or discrepancies detected.',
    verify_title: 'Public Record Verification',
    qr_scan_instruction: 'Scan this QR code to verify mutation legitimacy directly against the immutable ledger.',
    tamper_audit_title: 'Cryptographic Audit Ledger',
    verify_chain_button: 'Verify Audit Chain Integrity',
    chain_valid: 'No alteration detected: the audit chain and all deeds match.',
    chain_invalid: 'Warning! Data tampering or chain corruption detected!',
    demo_title: 'Student Presentation & Demo Control Panel',
    demo_subtitle: 'Gated console for rehearsing evaluation scenarios without manual database edits.',
    demo_reset_btn: 'Reset All Data to Clean Seed',
    demo_resetting: 'Resetting...',
    demo_concurrent_btn: 'Fire two conflicting requests at once',
    demo_concurrent_hint: 'Hint: Reset demo data first so P-001 has no active transfers, allowing the race condition detection to be demonstrated cleanly.',
    evidence_msg_double_sale: 'Parcel already has an active transfer; concurrent transfer cannot proceed.',
    evidence_msg_concurrent_double_sale: 'Concurrent transfer inserted simultaneously; current request placed on hold.',
    evidence_msg_wrong_seller: 'Deed seller does not match the currently registered parcel owner.',
    checkpoint_section_title: 'Audit checkpoint',
    checkpoint_note: 'Keep the checkpoint somewhere outside this database. It only protects you if the copy cannot be edited together with the database.',
    checkpoint_export_btn: 'Export checkpoint',
    checkpoint_exporting: 'Exporting...',
    checkpoint_verify_title: 'Verify against checkpoint',
    checkpoint_verify_btn: 'Verify against checkpoint',
    checkpoint_verifying: 'Verifying...',
    checkpoint_match_title: 'MATCH — Matches checkpoint',
    checkpoint_mismatch_title: 'MISMATCH — Does not match the checkpoint',
    checkpoint_check_signature: 'Signature valid',
    checkpoint_check_chain: 'Chain valid',
    checkpoint_check_head: 'Head hash matches',
    checkpoint_check_length: 'Chain not shorter',
  },
};

const STATUS_TRANSLATION_KEYS: Record<string, keyof typeof translations.bn> = {
  submitted: 'status_submitted',
  verified: 'status_verified',
  under_review: 'status_under_review',
  approved: 'status_approved',
  finalized: 'status_finalized',
  held: 'status_held',
  rejected: 'status_rejected',
};

const EVIDENCE_MESSAGE_KEYS: Record<string, keyof typeof translations.bn> = {
  'Parcel already has an active transfer; concurrent transfer cannot proceed.':
    'evidence_msg_double_sale',
  'Concurrent transfer inserted simultaneously; current request placed on hold.':
    'evidence_msg_concurrent_double_sale',
  'Deed seller does not match the currently registered parcel owner.':
    'evidence_msg_wrong_seller',
};

/**
 * Translates a known workflow status code using the app's status dictionary.
 * Unknown status strings are returned unchanged.
 */
export function translateStatus(status: string | null | undefined, lang: Language): string {
  if (!status) return '';
  const normalized = status.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(STATUS_TRANSLATION_KEYS, normalized)) {
    const key = STATUS_TRANSLATION_KEYS[normalized];
    return translations[lang][key] || translations.bn[key] || status;
  }
  return status;
}

/**
 * Translates known fixed rules-engine evidence messages in the UI layer.
 * Unknown messages are returned unchanged.
 */
export function translateEvidenceMessage(message: string | null | undefined, lang: Language): string {
  if (!message) return '';
  const trimmed = message.trim();
  if (Object.prototype.hasOwnProperty.call(EVIDENCE_MESSAGE_KEYS, trimmed)) {
    const key = EVIDENCE_MESSAGE_KEYS[trimmed];
    return translations[lang][key] || message;
  }
  return message;
}
