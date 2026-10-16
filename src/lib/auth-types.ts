export type UserRole = 'applicant' | 'reviewer' | 'system';

export interface UserSession {
  username: string;
  fullName: string;
  role: UserRole;
  nid?: string;
}

export const DEMO_COOKIE_NAME = 'mg_demo_user';

// Known seeded demo accounts
export const SEEDED_USERS: Record<string, UserSession> = {
  officer_farhan: {
    username: 'officer_farhan',
    fullName: 'Farhan Ahmed (AC Land)',
    role: 'reviewer',
  },
  rahim_uddin: {
    username: 'rahim_uddin',
    fullName: 'Rahim Uddin',
    role: 'applicant',
    nid: '1985000000001',
  },
  karim_chowdhury: {
    username: 'karim_chowdhury',
    fullName: 'Karim Chowdhury',
    role: 'applicant',
    nid: '1988000000002',
  },
  hasan_mahmud: {
    username: 'hasan_mahmud',
    fullName: 'Hasan Mahmud',
    role: 'applicant',
    nid: '1992000000003',
  },
  system_audit: {
    username: 'system_audit',
    fullName: 'MutationGuard System Audit',
    role: 'system',
  },
};
