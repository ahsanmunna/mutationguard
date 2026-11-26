import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { LanguageProvider } from '../../src/components/LanguageContext';
import ConflictAlert, {
  formatEvidenceKey,
  formatEvidenceScalar,
} from '../../src/components/ConflictAlert';
import {
  formatOptionalDate,
  formatIdentifier,
  isIdentifier,
  translateStatus,
  translateEvidenceMessage,
  translations,
} from '../../src/lib/i18n/translations';
import type { Finding } from '../../src/lib/rules/types';

describe('Phase 6 display polish pure helpers', () => {
  describe('formatOptionalDate (date formatting wrapper)', () => {
    it('formats ISO timestamps like 2026-02-10T00:00:00.000Z in English and Bangla', () => {
      expect(formatOptionalDate('2026-02-10T00:00:00.000Z', 'en')).toBe('2026-02-10');
      expect(formatOptionalDate('2026-02-10T00:00:00.000Z', 'bn')).toBe('২০২৬-০২-১০');
    });

    it('formats YYYY-MM-DD strings and Date objects consistently', () => {
      expect(formatOptionalDate('2026-01-15', 'en')).toBe('2026-01-15');
      expect(formatOptionalDate('2026-01-15', 'bn')).toBe('২০২৬-০১-১৫');
      expect(formatOptionalDate(new Date('2026-03-01T00:00:00.000Z'), 'en')).toBe('2026-03-01');
      expect(formatOptionalDate(new Date('2026-03-01T00:00:00.000Z'), 'bn')).toBe('২০২৬-০৩-০১');
    });

    it('returns fallback em-dash for empty, null, undefined, or invalid Date instances', () => {
      expect(formatOptionalDate(null, 'en')).toBe('—');
      expect(formatOptionalDate(undefined, 'bn')).toBe('—');
      expect(formatOptionalDate('', 'en')).toBe('—');
      expect(formatOptionalDate('   ', 'bn')).toBe('—');
      expect(formatOptionalDate(new Date('invalid'), 'en')).toBe('—');
      expect(formatOptionalDate(null, 'en', 'N/A')).toBe('N/A');
    });
  });

  describe('identifier formatting', () => {
    it('recognizes hyphenated identifiers and preserves hyphens verbatim', () => {
      for (const id of ['P-001', 'TR-2026-0008', 'DEED-2026-001', 'NID-DEMO-0001', 'K-501', 'D-1001']) {
        expect(isIdentifier(id)).toBe(true);
        expect(formatIdentifier(id)).toBe(id);
        expect(formatEvidenceScalar('parcel_id', id, 'en')).toBe(id);
        expect(formatEvidenceScalar('conflict_id', id, 'bn')).toBe(id);
      }
      expect(formatIdentifier('  TR-2026-0008  ')).toBe('TR-2026-0008');
    });

    it('returns fallback for missing identifiers and does not classify prose as an identifier', () => {
      expect(formatIdentifier(null)).toBe('—');
      expect(formatIdentifier(undefined)).toBe('—');
      expect(formatIdentifier('  ')).toBe('—');
      expect(
        isIdentifier('Parcel already has an active transfer; concurrent transfer cannot proceed.')
      ).toBe(false);
    });

    it('prettifies unknown English labels while leaving values and Bangla keys intact', () => {
      expect(formatEvidenceKey('parcel_id', false)).toBe('Parcel ID');
      expect(formatEvidenceKey('parcel_id', true)).toBe('পার্সেল আইডি');
      expect(formatEvidenceKey('custom-extra_key', false)).toBe('custom extra key');
      expect(formatEvidenceKey('custom-extra_key', true)).toBe('custom-extra_key');
    });
  });

  describe('status and message translation lookup', () => {
    it('translates all workflow statuses using the same wording as translations.ts', () => {
      const statuses = [
        'submitted',
        'verified',
        'under_review',
        'approved',
        'finalized',
        'held',
        'rejected',
      ] as const;

      for (const s of statuses) {
        const key = `status_${s}` as keyof typeof translations.bn;
        expect(translateStatus(s, 'bn')).toBe(translations.bn[key]);
        expect(translateStatus(s, 'en')).toBe(translations.en[key]);
      }
    });

    it('normalizes whitespace/case for known statuses and leaves unknown statuses unchanged', () => {
      expect(translateStatus('  VERIFIED  ', 'bn')).toBe('যাচাইকৃত');
      expect(translateStatus('held', 'bn')).toBe('স্থগিত');
      expect(translateStatus('custom_state', 'bn')).toBe('custom_state');
      expect(translateStatus('', 'bn')).toBe('');
      expect(translateStatus(null, 'en')).toBe('');
    });

    it('translates known fixed rules-engine messages in Bangla and keeps unknown messages unchanged', () => {
      const known = [
        'Parcel already has an active transfer; concurrent transfer cannot proceed.',
        'Concurrent transfer inserted simultaneously; current request placed on hold.',
        'Deed seller does not match the currently registered parcel owner.',
      ];

      for (const msg of known) {
        expect(translateEvidenceMessage(msg, 'en')).toBe(msg);
        const bnMsg = translateEvidenceMessage(msg, 'bn');
        expect(bnMsg).not.toBe(msg);
        expect(bnMsg.length).toBeGreaterThan(0);
      }

      const unknown = 'Unexpected custom audit signal from external check.';
      expect(translateEvidenceMessage(unknown, 'bn')).toBe(unknown);
      expect(translateEvidenceMessage(unknown, 'en')).toBe(unknown);
      expect(translateEvidenceMessage('', 'bn')).toBe('');
    });
  });
});

describe('ConflictAlert rendering with Phase 6 fixes', () => {
  const doubleSaleFinding: Finding = {
    rule_id: 'DOUBLE_SALE',
    expected: {
      active_transfer_count: 0,
      parcel_id: 'P-001',
    },
    observed: {
      active_transfer_id: 'TR-2026-0008',
      active_status: 'verified',
      active_applicant: 'karim_chowdhury',
    },
    evidence: {
      rule: 'DOUBLE_SALE',
      parcel_id: 'P-001',
      conflict_id: 'TR-2026-0008',
      status: 'verified',
      message: 'Parcel already has an active transfer; concurrent transfer cannot proceed.',
    },
    action: 'hold',
  };

  it('keeps hyphens in P-001 and TR-2026-0008 in English view', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(ConflictAlert, { findings: [doubleSaleFinding], language: 'en' })
      )
    );
    expect(html).toContain('P-001');
    expect(html).toContain('TR-2026-0008');
    expect(html).not.toContain('P 001');
    expect(html).not.toContain('TR 2026 0008');
    expect(html).toContain('Verified');
    expect(html).toContain('Parcel already has an active transfer; concurrent transfer cannot proceed.');
  });

  it('translates evidence message and status words in Bangla view while keeping identifiers intact', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(ConflictAlert, { findings: [doubleSaleFinding], language: 'bn' })
      )
    );
    expect(html).toContain('P-001');
    expect(html).toContain('TR-2026-0008');
    expect(html).toContain('যাচাইকৃত');
    expect(html).not.toContain('>verified<');
    expect(html).toContain(translations.bn.evidence_msg_double_sale);
    expect(html).not.toContain('Parcel already has an active transfer; concurrent transfer cannot proceed.');
  });

  it('leaves unknown evidence messages unchanged in Bangla view', () => {
    const customFinding: Finding = {
      rule_id: 'DOUBLE_SALE',
      expected: { parcel_id: 'P-003' },
      observed: { concurrent_transfer_id: 'TR-2026-0009', concurrent_status: 'held' },
      evidence: {
        parcel_id: 'P-003',
        conflicting_transfer_id: 'TR-2026-0009',
        status: 'held',
        message: 'Some future engine message not yet mapped.',
      },
      action: 'hold',
    };

    const html = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(ConflictAlert, { findings: [customFinding], language: 'bn' })
      )
    );
    expect(html).toContain('P-003');
    expect(html).toContain('TR-2026-0009');
    expect(html).toContain('স্থগিত');
    expect(html).toContain('Some future engine message not yet mapped.');
  });

  it('translates WRONG_SELLER message in Bangla and keeps NID identifiers with hyphens', () => {
    const wrongSellerFinding: Finding = {
      rule_id: 'WRONG_SELLER',
      expected: { owner_name: 'Rahim Uddin', owner_nid: 'NID-DEMO-0001' },
      observed: { seller_name: 'Hasan Mahmud', seller_nid: 'NID-DEMO-0003' },
      evidence: {
        rule: 'WRONG_SELLER',
        parcel_id: 'P-001',
        name_mismatch: true,
        nid_mismatch: true,
        message: 'Deed seller does not match the currently registered parcel owner.',
      },
      action: 'hold',
    };

    const htmlBn = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(ConflictAlert, { findings: [wrongSellerFinding], language: 'bn' })
      )
    );
    expect(htmlBn).toContain('P-001');
    expect(htmlBn).toContain('NID-DEMO-0001');
    expect(htmlBn).toContain('NID-DEMO-0003');
    expect(htmlBn).toContain(translations.bn.evidence_msg_wrong_seller);
    expect(htmlBn).not.toContain('Deed seller does not match the currently registered parcel owner.');
  });
});
