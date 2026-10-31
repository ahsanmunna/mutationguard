'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FilePlus2, TriangleAlert, Inbox, Search, Check } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import { PageHeader, Button, EmptyState } from '@/components/ui';
import { useLanguage } from '@/components/LanguageContext';
import { localName, formatDate, formatCount } from '@/lib/i18n/translations';
import { useCurrentUser } from '@/lib/use-current-user';

export default function DashboardPage() {
  const { language } = useLanguage();
  const bn = language === 'bn';

  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Who is logged in comes from the server (signed httpOnly session), not from the browser.
  const { user: sessionUser } = useCurrentUser();
  const currentUsername = sessionUser?.username ?? '';
  const currentUser = sessionUser ?? { username: '', fullName: '', role: 'applicant' as const };
  const isReviewer = currentUser.role === 'reviewer';

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/transfers');
      const data = await res.json();
      if (data.transfers) {
        setTransfers(data.transfers);
      }
    } catch (err) {
      console.error('Failed to load transfers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  // Filter transfers: applicants only see their own submissions; reviewers see all.
  const visibleTransfers = isReviewer
    ? transfers
    : transfers.filter((tr) => tr.applicant_username === currentUsername);

  const filteredTransfers = visibleTransfers.filter((tr) => {
    if (statusFilter === 'all') return true;
    return tr.status === statusFilter;
  });

  const countByStatus = (status: string) =>
    visibleTransfers.filter((t) => t.status === status).length;

  const handleQuickTransition = async (transferId: string, newStatus: string) => {
    try {
      setActionInProgress(transferId);
      const res = await fetch(`/api/transfers/${transferId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || (bn ? 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে' : 'Transition failed'));
      } else {
        await fetchTransfers();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  // Status filter tabs definition.
  const tabs = [
    { key: 'all',          label: bn ? 'সকল'               : 'All'          },
    { key: 'verified',     label: bn ? 'যাচাইকৃত'          : 'Verified'     },
    { key: 'under_review', label: bn ? 'পর্যালোচনাধীন'     : 'Under Review' },
    { key: 'held',         label: bn ? 'স্থগিত'            : 'Held'         },
    { key: 'approved',     label: bn ? 'অনুমোদিত'          : 'Approved'     },
    { key: 'finalized',    label: bn ? 'চূড়ান্ত নিষ্পত্তিকৃত' : 'Finalized'  },
    { key: 'rejected',     label: bn ? 'বাতিলকৃত'          : 'Rejected'     },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* Page Header */}
      <PageHeader
        kicker={
          isReviewer
            ? (bn ? 'সহকারী কমিশনার (ভূমি) কিউ' : 'AC Land Review Queue')
            : (bn ? 'আবেদনকারীর ড্যাশবোর্ড'     : 'Applicant Dashboard')
        }
        title={
          isReviewer
            ? (bn ? 'নামজারি আবেদন ও পর্যালোচনা ড্যাশবোর্ড' : 'Official Mutation Review Queue')
            : (bn ? 'আমার নামজারি আবেদনসমূহ'                  : 'My Mutation Applications')
        }
        description={
          isReviewer
            ? (bn
                ? 'দাখিলকৃত আবেদনসমূহ পর্যালোচনা, বিরোধ নিষ্পত্তি ও অনুমোদনের সরকারি প্যানেল।'
                : 'Review applications, examine rule conflicts, approve or reject transfers, and finalize mutations.')
            : (bn
                ? 'আপনার দাখিলকৃত নামজারি আবেদনের বর্তমান অগ্রগতি ও ডিজিটাল স্ট্যাটাস ট্র্যাক করুন।'
                : 'Track the status and timeline of your submitted mutation applications.')
        }
        action={
          <Link
            href="/transfers/new"
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <FilePlus2 className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'নতুন আবেদন দাখিল' : 'Submit New Application'}</span>
          </Link>
        }
      />

      {/* Compact stats row — four numbers, no cards, thin vertical dividers */}
      <div className="flex divide-x divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
        {[
          {
            label: bn ? 'মোট আবেদন'        : 'Total',
            value: formatCount(visibleTransfers.length, language),
            color: 'text-slate-800 dark:text-slate-100',
          },
          {
            label: bn ? 'সক্রিয় / পর্যালোচনায়' : 'Active / Review',
            value: formatCount(
              countByStatus('verified') + countByStatus('under_review') + countByStatus('approved'),
              language
            ),
            color: 'text-emerald-700 dark:text-emerald-400',
          },
          {
            label: bn ? 'স্থগিত (বিরোধ)' : 'Held / Conflicts',
            value: formatCount(countByStatus('held'), language),
            color: 'text-amber-700 dark:text-amber-400',
          },
          {
            label: bn ? 'চূড়ান্ত নিষ্পত্তিকৃত' : 'Finalized',
            value: formatCount(countByStatus('finalized'), language),
            color: 'text-blue-700 dark:text-blue-400',
          },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 px-4 py-3 min-w-0">
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{stat.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Status filter tab strip */}
      <div
        role="tablist"
        aria-label={bn ? 'স্ট্যাটাস ফিল্টার' : 'Status filter'}
        className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 pb-3"
      >
        {tabs.map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setStatusFilter(tab.key)}
              className={[
                'min-h-[44px] px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors',
                isActive
                  ? 'bg-emerald-700 text-white dark:bg-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Transfers table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {loading ? (
          /* Loading state */
          <div className="p-10 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
            <Search className="w-4 h-4 animate-pulse" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'তথ্য লোড হচ্ছে...' : 'Loading transfers...'}</span>
          </div>
        ) : filteredTransfers.length === 0 ? (
          /* Empty state */
          <EmptyState
            icon={Inbox}
            title={bn ? 'কোনো নামজারি রেকর্ড পাওয়া যায়নি' : 'No transfers found'}
            description={
              bn
                ? 'আবেদন দাখিল করতে বা ডেমো ডাটা দেখতে উপরের বোতামটি ব্যবহার করুন।'
                : 'Submit a new transfer or use the demo panel to seed test records.'
            }
          />
        ) : (
          /* Desktop table / mobile stacked rows */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">{bn ? 'আইডি'           : 'Transfer ID'  }</th>
                  <th className="px-4 py-3 whitespace-nowrap">{bn ? 'প্লট / মৌজা'    : 'Parcel / Mouza'}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{bn ? 'বিক্রেতা → ক্রেতা' : 'Seller → Buyer'}</th>
                  <th className="px-4 py-3 whitespace-nowrap">{bn ? 'স্ট্যাটাস'       : 'Status'       }</th>
                  <th className="px-4 py-3 whitespace-nowrap">{bn ? 'অসঙ্গতি'         : 'Findings'     }</th>
                  <th className="px-4 py-3 whitespace-nowrap">{bn ? 'তারিখ'           : 'Date'         }</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">{bn ? 'পদক্ষেপ' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransfers.map((tr) => {
                  const findingsCount = Array.isArray(tr.findings) ? tr.findings.length : 0;
                  const busy = actionInProgress === tr.id;
                  return (
                    <tr
                      key={tr.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Transfer ID — monospaced, links to detail page */}
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        <Link href={`/transfers/${tr.id}`} className="hover:underline underline-offset-2">
                          {tr.id}
                        </Link>
                      </td>

                      {/* Parcel ID + mouza */}
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900 dark:text-white">{tr.parcel_id}</span>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">{tr.application_mouza}</div>
                      </td>

                      {/* Seller → Buyer */}
                      <td className="px-4 py-3">
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                          {localName(tr.seller_name, language)}
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {localName(tr.buyer_name, language)}
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={tr.status} size="sm" />
                      </td>

                      {/* Findings count */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {findingsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold text-[11px] border border-rose-200 dark:border-rose-800">
                            <TriangleAlert className="w-3 h-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                            <span>{formatCount(findingsCount, language)} {bn ? 'টি' : ''}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <Check className="w-3 h-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                            <span>{bn ? 'সঠিক' : 'Clean'}</span>
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatDate(tr.created_at, language)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick "Start Review" for reviewer when status is verified */}
                          {isReviewer && tr.status === 'verified' && (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={busy}
                              disabled={busy}
                              onClick={() => handleQuickTransition(tr.id, 'under_review')}
                            >
                              {bn ? 'পর্যালোচনা' : 'Review'}
                            </Button>
                          )}

                          {/* Quick "Approve" for reviewer when status is under_review */}
                          {isReviewer && tr.status === 'under_review' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={busy}
                              disabled={busy}
                              onClick={() => handleQuickTransition(tr.id, 'approved')}
                            >
                              {bn ? 'অনুমোদন' : 'Approve'}
                            </Button>
                          )}

                          {/* Details link — always visible */}
                          <Link
                            href={`/transfers/${tr.id}`}
                            className="inline-flex items-center justify-center gap-1 min-h-[36px] px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors"
                          >
                            {bn ? 'বিস্তারিত' : 'Details'}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
