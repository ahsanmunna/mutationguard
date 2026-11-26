import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { LanguageProvider } from '../../src/components/LanguageContext';
import RecordComparison from '../../src/components/RecordComparison';
import { compareRecords, ComparisonRow } from '../../src/lib/wizard';
import type { Language } from '../../src/lib/i18n/translations';

const baseRegistry = {
  mouza: 'Dhanmondi-102',
  khatian: 'K-501',
  dag: 'D-1001',
  area_decimal: '5.00',
  current_owner_name: 'Rahim Uddin',
};

const baseDeed = {
  deed_mouza: 'Dhanmondi-102',
  deed_khatian: 'K-501',
  deed_dag: 'D-1001',
  deed_area_decimal: '5.00',
  seller_name: 'Rahim Uddin',
};

const baseApplication = {
  application_mouza: 'Dhanmondi-102',
  application_khatian: 'K-501',
  application_dag: 'D-1001',
  application_area_decimal: '5.00',
};

function makeRows(diffCount: 0 | 1 | 2): ComparisonRow[] {
  return compareRecords({
    registry: baseRegistry,
    deed: {
      ...baseDeed,
      deed_dag: diffCount >= 1 ? 'D-9999' : baseDeed.deed_dag,
      deed_khatian: diffCount >= 2 ? 'K-999' : baseDeed.deed_khatian,
    },
    application: {
      ...baseApplication,
      application_dag: diffCount >= 1 ? 'D-9999' : baseApplication.application_dag,
      application_khatian: diffCount >= 2 ? 'K-999' : baseApplication.application_khatian,
    },
  });
}

function renderSummary(props: {
  rows: ComparisonRow[];
  language: Language;
  mode?: 'preview' | 'stored';
  sellerNotCompared?: boolean;
}): string {
  const html = renderToStaticMarkup(
    React.createElement(
      LanguageProvider,
      null,
      React.createElement(RecordComparison, props)
    )
  );
  const statusMatch = html.match(/role="status"[\s\S]*?<span>([\s\S]*?)<\/span>/);
  return statusMatch ? statusMatch[1] : html;
}

describe('RecordComparison summary wording', () => {
  it('preview + differences (1 and 2) keeps pre-submission wording in EN and BN', () => {
    const oneDiffEn = renderSummary({ rows: makeRows(1), language: 'en' });
    expect(oneDiffEn).toBe(
      '1 potential difference found. The rules check these when you submit and are likely to hold this application for review.'
    );

    const twoDiffEn = renderSummary({ rows: makeRows(2), language: 'en', mode: 'preview' });
    expect(twoDiffEn).toBe(
      '2 potential differences found. The rules check these when you submit and are likely to hold this application for review.'
    );

    const oneDiffBn = renderSummary({ rows: makeRows(1), language: 'bn' });
    expect(oneDiffBn).toContain('১টি সম্ভাব্য অমিল পাওয়া গেছে।');
    expect(oneDiffBn).toContain('আবেদন দাখিল করার সময় নিয়মগুলো এগুলো যাচাই করবে');
  });

  it('stored + differences (1 and 2) uses stored wording in EN and BN', () => {
    const oneDiffEn = renderSummary({ rows: makeRows(1), language: 'en', mode: 'stored' });
    expect(oneDiffEn).toBe(
      '1 potential difference recorded between these records. See the rule findings above for the review outcome.'
    );

    const twoDiffEn = renderSummary({ rows: makeRows(2), language: 'en', mode: 'stored' });
    expect(twoDiffEn).toBe(
      '2 potential differences recorded between these records. See the rule findings above for the review outcome.'
    );

    const oneDiffBn = renderSummary({ rows: makeRows(1), language: 'bn', mode: 'stored' });
    expect(oneDiffBn).toContain('১টি সম্ভাব্য অমিল নথিভুক্ত হয়েছে।');
    expect(oneDiffBn).toContain('উপরের নীতিমালার ফলাফলসমূহ দেখুন।');

    const twoDiffBn = renderSummary({ rows: makeRows(2), language: 'bn', mode: 'stored' });
    expect(twoDiffBn).toContain('২টি সম্ভাব্য অমিল নথিভুক্ত হয়েছে।');
  });

  it('stored + no differences agrees across the three records in EN and BN', () => {
    const noDiffEn = renderSummary({ rows: makeRows(0), language: 'en', mode: 'stored' });
    expect(noDiffEn).toBe('The compared fields agree across the three records.');

    const noDiffBn = renderSummary({ rows: makeRows(0), language: 'bn', mode: 'stored' });
    expect(noDiffBn).toBe('তিনটি রেকর্ডের তুলনা করা ক্ষেত্রগুলোতে মিল রয়েছে।');
  });

  it('stored + sellerNotCompared + no differences does not claim three records agree', () => {
    const en = renderSummary({
      rows: makeRows(0),
      language: 'en',
      mode: 'stored',
      sellerNotCompared: true,
    });
    expect(en).toBe('The compared fields agree. The seller row could not be compared.');
    expect(en.toLowerCase()).not.toContain('the three records agree');

    const bn = renderSummary({
      rows: makeRows(0),
      language: 'bn',
      mode: 'stored',
      sellerNotCompared: true,
    });
    expect(bn).toBe('তুলনা করা ক্ষেত্রগুলোতে মিল রয়েছে। বিক্রেতার সারি তুলনা করা যায়নি।');
    expect(bn).not.toContain('তিনটি রেকর্ড');
  });

  it('stored + sellerNotCompared + differences keeps stored differences wording', () => {
    const en = renderSummary({
      rows: makeRows(1),
      language: 'en',
      mode: 'stored',
      sellerNotCompared: true,
    });
    expect(en).toBe(
      '1 potential difference recorded between these records. See the rule findings above for the review outcome.'
    );
  });

  it('shows muted "not part of the application" note only on the seller row in EN and BN', () => {
    const rows = makeRows(0);

    const htmlEn = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(RecordComparison, { rows, language: 'en', mode: 'stored' })
      )
    );
    const rowsEn = htmlEn.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    const sellerRowEn = rowsEn.find((r) => r.includes('Seller / Owner'));
    expect(sellerRowEn).toBeDefined();
    expect(sellerRowEn).toContain('—');
    expect(sellerRowEn).toContain('not part of the application');
    // Desktop table has 1 seller row note + mobile block has 1 seller row note = 2 occurrences total
    expect(htmlEn.match(/not part of the application/g)).toHaveLength(2);
    expect(htmlEn.match(/not compared by the rules/g)).toHaveLength(2);

    const khatianRowEn = rowsEn.find((r) => r.includes('>Khatian<'));
    expect(khatianRowEn).toBeDefined();
    expect(khatianRowEn).not.toContain('not part of the application');
    expect(khatianRowEn).not.toContain('not compared by the rules');

    const htmlBn = renderToStaticMarkup(
      React.createElement(
        LanguageProvider,
        null,
        React.createElement(RecordComparison, { rows, language: 'bn', mode: 'stored' })
      )
    );
    const rowsBn = htmlBn.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];
    const sellerRowBn = rowsBn.find((r) => r.includes('বিক্রেতা / মালিক'));
    expect(sellerRowBn).toBeDefined();
    expect(sellerRowBn).toContain('—');
    expect(sellerRowBn).toContain('আবেদনের অংশ নয়');
    expect(htmlBn.match(/আবেদনের অংশ নয়/g)).toHaveLength(2);
    expect(htmlBn.match(/নিয়মে তুলনা করা হয় না/g)).toHaveLength(2);
  });
});
