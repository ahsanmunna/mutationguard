'use client';

import React from 'react';
import { CircleCheck, TriangleAlert, OctagonX, Search, ShieldAlert } from 'lucide-react';
import { Finding } from '@/lib/rules/types';
import { useLanguage } from './LanguageContext';

interface ConflictAlertProps {
  findings: Finding[];
}

/** Formats a known evidence / expected / observed key into friendly bilingual text. */
function formatKey(key: string, bn: boolean): string {
  const map: Record<string, { bn: string; en: string }> = {
    parcel_id: { bn: 'পার্সেল আইডি', en: 'Parcel ID' },
    parcel: { bn: 'পার্সেল / প্লট', en: 'Parcel' },
    status: { bn: 'স্ট্যাটাস', en: 'Status' },
    active_status: { bn: 'সক্রিয় স্ট্যাটাস', en: 'Active Status' },
    conflict_id: { bn: 'সংঘাতপূর্ণ হস্তান্তর আইডি', en: 'Conflicting Transfer ID' },
    active_transfer_id: { bn: 'বিদ্যমান সক্রিয় হস্তান্তর আইডি', en: 'Active Transfer ID' },
    active_applicant: { bn: 'বিদ্যমান আবেদনকারী', en: 'Active Applicant' },
    active_transfer_count: { bn: 'সক্রিয় হস্তান্তর সংখ্যা', en: 'Active Transfer Count' },
    seller_name: { bn: 'বিক্রেতার নাম', en: 'Seller Name' },
    seller_nid: { bn: 'বিক্রেতার এনআইডি', en: 'Seller NID' },
    deed_seller: { bn: 'দলিল বিক্রেতা', en: 'Deed Seller' },
    owner_name: { bn: 'রেকর্ডীয় মালিকের নাম', en: 'Registered Owner Name' },
    owner_nid: { bn: 'রেকর্ডীয় মালিকের এনআইডি', en: 'Registered Owner NID' },
    name_mismatch: { bn: 'নামের অমিল', en: 'Name Mismatch' },
    nid_mismatch: { bn: 'এনআইডির অমিল', en: 'NID Mismatch' },
    total_mismatches: { bn: 'মোট অমিল ক্ষেত্র', en: 'Total Mismatches' },
    differing_fields: { bn: 'অমিল ক্ষেত্রসমূহ', en: 'Differing Fields' },
    deed_vs_registry_mouza: { bn: 'দলিল বনাম রেকর্ড মৌজা', en: 'Deed vs Registry Mouza' },
    deed_vs_registry_khatian: { bn: 'দলিল বনাম রেকর্ড খতিয়ান', en: 'Deed vs Registry Khatian' },
    deed_vs_registry_dag: { bn: 'দলিল বনাম রেকর্ড দাগ', en: 'Deed vs Registry Dag' },
    deed_vs_registry_area: { bn: 'দলিল বনাম রেকর্ড পরিমাণ', en: 'Deed vs Registry Area' },
    deed_vs_registry_seller: { bn: 'দলিল বনাম রেকর্ড বিক্রেতা', en: 'Deed vs Registry Seller' },
    application_vs_deed_khatian: { bn: 'আবেদন বনাম দলিল খতিয়ান', en: 'Application vs Deed Khatian' },
    application_vs_deed_dag: { bn: 'আবেদন বনাম দলিল দাগ', en: 'Application vs Deed Dag' },
    application_vs_deed_area: { bn: 'আবেদন বনাম দলিল পরিমাণ', en: 'Application vs Deed Area' },
    mouza: { bn: 'মৌজা', en: 'Mouza' },
    khatian: { bn: 'খতিয়ান', en: 'Khatian' },
    dag: { bn: 'দাগ', en: 'Dag' },
    area: { bn: 'জমির পরিমাণ', en: 'Area' },
    area_decimal: { bn: 'জমির পরিমাণ (শতক)', en: 'Area (Decimal)' },
    message: { bn: 'বিবরণ', en: 'Message' },
    rule: { bn: 'নিয়ম', en: 'Rule' },
  };

  if (map[key]) {
    return bn ? map[key].bn : map[key].en;
  }
  return key;
}

/** Formats an evidence value into a clean human-readable representation without raw JSON braces. */
function formatValue(val: any, bn: boolean): React.ReactNode {
  if (val === null || val === undefined) {
    return <span className="text-slate-400">—</span>;
  }
  if (typeof val === 'boolean') {
    return val ? (bn ? 'হ্যাঁ' : 'Yes') : (bn ? 'না' : 'No');
  }
  if (typeof val === 'number') {
    return <span className="font-mono">{val}</span>;
  }
  if (typeof val === 'string') {
    return <span>{val}</span>;
  }
  if (Array.isArray(val)) {
    return (
      <div className="space-y-1">
        {val.map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const fieldLabel = item.field ? formatKey(item.field, bn) : (item.source || `Item ${idx + 1}`);
            return (
              <div key={idx} className="text-xs bg-slate-50 dark:bg-slate-950 p-2 rounded border border-slate-200 dark:border-slate-800">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">{fieldLabel}</span>
                <span className="text-slate-500">{bn ? 'প্রত্যাশিত:' : 'Expected:'} </span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{String(item.expected)}</span>
                {' · '}
                <span className="text-rose-600 dark:text-rose-400">{bn ? 'প্রাপ্ত:' : 'Observed:'} </span>
                <span className="font-mono font-semibold text-rose-700 dark:text-rose-300">{String(item.observed)}</span>
              </div>
            );
          }
          return <div key={idx}>{String(item)}</div>;
        })}
      </div>
    );
  }
  if (typeof val === 'object') {
    return (
      <div className="space-y-1">
        {Object.entries(val).map(([subKey, subVal]) => (
          <div key={subKey} className="flex justify-between gap-2 text-xs">
            <span className="text-slate-500 font-mono">{formatKey(subKey, bn)}:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200">{String(subVal)}</span>
          </div>
        ))}
      </div>
    );
  }
  return String(val);
}

export default function ConflictAlert({ findings }: ConflictAlertProps) {
  const { language } = useLanguage();
  const bn = language === 'bn';

  if (!findings || findings.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
        <CircleCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <div>
          <p className="font-semibold text-sm">
            {bn ? 'কোনো অসঙ্গতি পাওয়া যায়নি' : 'No Conflicts Detected'}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
            {bn
              ? 'সকল নিরাপত্তা নীতি ও রেজিস্ট্রি তথ্যের মিল যাচাই সফল হয়েছে।'
              : 'All security rules and registry records verified clean.'}
          </p>
        </div>
      </div>
    );
  }

  const getRuleDetails = (ruleId: string) => {
    switch (ruleId) {
      case 'DOUBLE_SALE':
        return {
          title: bn ? 'দ্বৈত হস্তান্তর সনাক্তকরণ' : 'Double Sale Detection',
          explanation: bn
            ? 'জমিটিতে ইতিমধ্যে একটি সক্রিয় নামজারি হস্তান্তর চলমান রয়েছে; একই সাথে দুটি হস্তান্তর চলতে পারে না।'
            : 'Parcel already has an active transfer in progress; concurrent transfer cannot proceed.',
          Icon: OctagonX,
        };
      case 'WRONG_SELLER':
        return {
          title: bn ? 'অননুমোদিত বিক্রেতা' : 'Unregistered Seller',
          explanation: bn
            ? 'দলিলদাতার নাম বা এনআইডি রেজিস্ট্রি রেকর্ডের বর্তমান আইনানুগ মালিকের সাথে মেলেনি।'
            : 'Deed seller does not match the currently registered parcel owner in the land registry.',
          Icon: TriangleAlert,
        };
      case 'RECORD_MISMATCH':
        return {
          title: bn ? 'রেকর্ড ও দলিলের অসঙ্গতি' : 'Record Mismatch',
          explanation: bn
            ? 'দলিল, রেজিস্ট্রি রেকর্ড বা নামজারি আবেদনের তথ্যের মধ্যে অমিল রয়েছে।'
            : 'Discrepancy detected between deed, land registry or mutation application.',
          Icon: Search,
        };
      default:
        return {
          title: ruleId,
          explanation: bn
            ? 'আবেদনে নীতি সংক্রান্ত অসঙ্গতি সনাক্ত হয়েছে।'
            : 'Policy conflict detected for this application.',
          Icon: ShieldAlert,
        };
    }
  };

  return (
    <div className="space-y-3">
      {/* Findings Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-400 flex items-center gap-1.5">
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>
            {bn ? 'সনাক্তকৃত অসঙ্গতিসমূহ' : 'Detected Conflicts'} ({findings.length})
          </span>
        </h4>
        <span className="inline-flex items-center gap-1 text-xs uppercase font-semibold px-2.5 py-1 rounded-md bg-rose-600 text-white shadow-xs">
          <OctagonX className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <span>{bn ? 'পদক্ষেপ: স্থগিত' : 'ACTION: HOLD'}</span>
        </span>
      </div>

      {/* Individual Finding Blocks */}
      {findings.map((finding, idx) => {
        const { title, explanation, Icon: RuleIcon } = getRuleDetails(finding.rule_id);
        const evidenceEntries =
          finding.evidence && typeof finding.evidence === 'object'
            ? Object.entries(finding.evidence).filter(([k]) => k !== 'rule')
            : [];

        return (
          <div
            key={idx}
            className="p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-[3px] border-l-rose-600 space-y-3 text-xs"
          >
            {/* Rule Name and One-line Explanation */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 text-sm">
                  <RuleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>{title}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                  {finding.rule_id}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {explanation}
              </p>
            </div>

            {/* Evidence Rows (No raw JSON braces) */}
            {evidenceEntries.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-950 rounded-md p-3 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                  {bn ? 'প্রমাণক তথ্য (Evidence):' : 'Evidence Particulars:'}
                </span>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {evidenceEntries.map(([k, v]) => (
                    <div key={k} className="py-1 flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                      <span className="font-medium text-slate-600 dark:text-slate-400 shrink-0">
                        {formatKey(k, bn)}:
                      </span>
                      <div className="text-slate-900 dark:text-slate-100 text-right sm:max-w-md">
                        {formatValue(v, bn)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Two-column "Expected | Observed" List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Expected Column */}
              <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide block">
                  {bn ? 'প্রত্যাশিত মান (Expected)' : 'Expected Value'}
                </span>
                <div className="space-y-1">
                  {typeof finding.expected === 'object' && finding.expected !== null ? (
                    Object.entries(finding.expected).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0">
                        <span className="text-slate-500">{formatKey(k, bn)}:</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {String(v)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="font-mono text-slate-800 dark:text-slate-200">
                      {String(finding.expected)}
                    </p>
                  )}
                </div>
              </div>

              {/* Observed Column */}
              <div className="p-3 rounded-md bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 space-y-1.5">
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide block">
                  {bn ? 'প্রাপ্ত মান (Observed)' : 'Observed Value'}
                </span>
                <div className="space-y-1">
                  {typeof finding.observed === 'object' && finding.observed !== null ? (
                    Object.entries(finding.observed).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2 py-0.5 border-b border-rose-100 dark:border-rose-900/40 last:border-b-0">
                        <span className="text-rose-800 dark:text-rose-300">{formatKey(k, bn)}:</span>
                        <span className="font-mono font-semibold text-rose-900 dark:text-rose-200">
                          {String(v)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="font-mono text-rose-900 dark:text-rose-200 font-semibold">
                      {String(finding.observed)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
