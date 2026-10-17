export type UserRole = 'applicant' | 'reviewer' | 'system';

export interface UserSession {
  username: string;
  fullName: string;
  role: UserRole;
  nid?: string;
}

export const DEMO_COOKIE_NAME = 'mg_demo_user';

/**
 * Canonical fake NID map used across seed, tests, and demo presets.
 * All IDs are obviously fictional — format NID-DEMO-XXXX.
 * No real national ID numbers are used anywhere in this project.
 */
export const DEMO_NIDS: Record<string, string> = {
  rahim_uddin:      'NID-DEMO-0001',
  karim_chowdhury:  'NID-DEMO-0002',
  hasan_mahmud:     'NID-DEMO-0003',
  abdul_maleque:    'NID-DEMO-0004',
  nasima_akter:     'NID-DEMO-0005', // Previously "Begum Rokeya" – renamed to fictional character
  shamsul_haque:    'NID-DEMO-0006',
  tariqul_islam:    'NID-DEMO-0007',
  nasreen_akhtar:   'NID-DEMO-0008',
  rafiqul_alam:     'NID-DEMO-0009',
  zubair_hossain:   'NID-DEMO-0010',
  officer_farhan:   'NID-DEMO-REVIEWER-001',
};

/**
 * STAGE A — TEMPORARY STUB:
 * Hardcoded user list for demo. Phase 4 replaces this with DB-loaded users.
 * Every route still calls requireAuth/requireRole so swapping is safe.
 */
export const SEEDED_USERS: Record<string, UserSession> = {
  officer_farhan: {
    username: 'officer_farhan',
    fullName: 'Farhan Ahmed (AC Land)',
    role: 'reviewer',
    nid: 'NID-DEMO-REVIEWER-001',
  },
  rahim_uddin: {
    username: 'rahim_uddin',
    fullName: 'Rahim Uddin',
    role: 'applicant',
    nid: 'NID-DEMO-0001',
  },
  karim_chowdhury: {
    username: 'karim_chowdhury',
    fullName: 'Karim Chowdhury',
    role: 'applicant',
    nid: 'NID-DEMO-0002',
  },
  hasan_mahmud: {
    username: 'hasan_mahmud',
    fullName: 'Hasan Mahmud',
    role: 'applicant',
    nid: 'NID-DEMO-0003',
  },
  system_audit: {
    username: 'system_audit',
    fullName: 'MutationGuard System Audit',
    role: 'system',
  },
};
