'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { useLanguage } from '@/components/LanguageContext';
import { localName, formatDate, formatCount } from '@/lib/i18n/translations';
import { SEEDED_USERS, DEMO_COOKIE_NAME } from '@/lib/auth-types';

export default function DashboardPage() {
  const { language } = useLanguage();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentUsername, setCurrentUsername] = useState<string>('officer_farhan');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${DEMO_COOKIE_NAME}=([^;]*)`));
    if (match && match[1]) {
      setCurrentUsername(decodeURIComponent(match[1]));
    }
  }, []);

  const currentUser = SEEDED_USERS[currentUsername] || {
    username: currentUsername,
    fullName: currentUsername,
    role: 'reviewer',
  };
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

  // Filter transfers: applicants only see their own submissions; reviewers see all
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
        alert(data.error || (language === 'bn' ? 'স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে' : 'Transition failed'));
      } else {
        await fetchTransfers();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              {isReviewer
                ? language === 'bn'
                  ? 'সহকারী কমিশনার (ভূমি) কিউ'
                  : 'AC Land Review Queue'
                : language === 'bn'
                ? 'আবেদনকারীর ড্যাশবোর্ড'
                : 'Applicant Dashboard'}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              @{currentUser.username} (
              {currentUser.role === 'reviewer'
                ? language === 'bn'
                  ? 'কর্মকর্তা'
                  : 'Reviewer'
                : language === 'bn'
                ? 'আবেদনকারী'
                : 'Applicant'}
              )
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {isReviewer
              ? language === 'bn'
                ? 'নামজারি আবেদন ও পর্যালোচনা ড্যাশবোর্ড'
                : 'Official Mutation Review Queue'
              : language === 'bn'
              ? 'আমার নামজারি আবেদনসমূহ'
              : 'My Mutation Applications'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isReviewer
              ? language === 'bn'
                ? 'দাখিলকৃত আবেদনসমূহ পর্যালোচনা, বিরোধ নিষ্পত্তি ও অনুমোদনের সরকারি প্যানেল।'
                : 'Review applications, examine rule conflicts, approve or reject transfers, and finalize mutations.'
              : language === 'bn'
              ? 'আপনার দাখিলকৃত নামজারি আবেদনের বর্তমান অগ্রগতি ও ডিজিটাল স্ট্যাটাস ট্র্যাক করুন।'
              : 'Track the status and timeline of your submitted mutation applications.'}
          </p>
        </div>

        <Link
          href="/transfers/new"
          className="min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition gap-1.5 shrink-0"
        >
          <span>➕</span>
          <span>{language === 'bn' ? 'নতুন আবেদন দাখিল' : 'Submit New Application'}</span>
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-500 font-semibold">
            {language === 'bn' ? 'মোট আবেদন' : 'Total Applications'}
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatCount(visibleTransfers.length, language)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            {language === 'bn' ? 'সক্রিয় ও পর্যালোচনায়' : 'Active / Under Review'}
          </p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {formatCount(
              countByStatus('verified') + countByStatus('under_review') + countByStatus('approved'),
              language
            )}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
            {language === 'bn' ? 'স্থগিত (বিরোধ সনাক্ত)' : 'Held / Conflicts'}
          </p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
            {formatCount(countByStatus('held'), language)}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
            {language === 'bn' ? 'চূড়ান্ত নিষ্পত্তিকৃত' : 'Finalized'}
          </p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1">
            {formatCount(countByStatus('finalized'), language)}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'all', label: language === 'bn' ? 'সকল' : 'All' },
          { key: 'verified', label: language === 'bn' ? 'যাচাইকৃত' : 'Verified' },
          { key: 'under_review', label: language === 'bn' ? 'পর্যালোচনাধীন' : 'Under Review' },
          { key: 'held', label: language === 'bn' ? 'স্থগিত' : 'Held' },
          { key: 'approved', label: language === 'bn' ? 'অনুমোদিত' : 'Approved' },
          { key: 'finalized', label: language === 'bn' ? 'চূড়ান্ত নিষ্পত্তিকৃত' : 'Finalized' },
          { key: 'rejected', label: language === 'bn' ? 'বাতিলকৃত' : 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center ${
              statusFilter === tab.key
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transfers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500 font-semibold flex items-center justify-center gap-2">
            <span className="animate-spin">⏳</span>
            <span>{language === 'bn' ? 'তথ্য লোড হচ্ছে...' : 'Loading transfers...'}</span>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="text-3xl">📭</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {language === 'bn' ? 'কোনো নামজারি রেকর্ড পাওয়া যায়নি' : 'No transfers found'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'bn'
                ? 'আবেদন দাখিল করতে বা ডেমো ডাটা দেখতে উপরের বোতামটি ব্যবহার করুন।'
                : 'Submit a new transfer or use the demo panel to seed test records.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">{language === 'bn' ? 'আইডি' : 'Transfer ID'}</th>
                  <th className="px-4 py-3">{language === 'bn' ? 'প্লট / মৌজা' : 'Parcel / Mouza'}</th>
                  <th className="px-4 py-3">{language === 'bn' ? 'ক্রেতা / বিক্রেতা' : 'Buyer / Seller'}</th>
                  <th className="px-4 py-3">{language === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="px-4 py-3">{language === 'bn' ? 'অসঙ্গতি ফলাফল' : 'Rule Findings'}</th>
                  <th className="px-4 py-3">{language === 'bn' ? 'তারিখ' : 'Date'}</th>
                  <th className="px-4 py-3 text-right">{language === 'bn' ? 'পদক্ষেপ' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransfers.map((tr) => {
                  const findingsCount = Array.isArray(tr.findings) ? tr.findings.length : 0;
                  return (
                    <tr
                      key={tr.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        <Link href={`/transfers/${tr.id}`} className="hover:underline">
                          {tr.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {tr.parcel_id}
                        </span>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {tr.application_mouza}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {localName(tr.buyer_name, language)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {language === 'bn' ? 'হতে:' : 'from:'} {localName(tr.seller_name, language)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={tr.status} size="sm" />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {findingsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold text-[11px] border border-rose-300 dark:border-rose-800">
                            <span>⚠️</span>
                            <span>
                              {formatCount(findingsCount, language)} {language === 'bn' ? 'টি অসঙ্গতি' : 'finding(s)'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                            <span>✓</span>
                            <span>{language === 'bn' ? 'সঠিক' : 'Clean'}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {formatDate(tr.created_at, language)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick review action for reviewer */}
                          {isReviewer && tr.status === 'verified' && (
                            <button
                              onClick={() => handleQuickTransition(tr.id, 'under_review')}
                              disabled={actionInProgress === tr.id}
                              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition inline-flex items-center gap-1"
                            >
                              <span>🔍</span>
                              <span>{language === 'bn' ? 'পর্যালোচনা' : 'Review'}</span>
                            </button>
                          )}
                          {isReviewer && tr.status === 'under_review' && (
                            <button
                              onClick={() => handleQuickTransition(tr.id, 'approved')}
                              disabled={actionInProgress === tr.id}
                              className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 transition inline-flex items-center gap-1"
                            >
                              <span>✓</span>
                              <span>{language === 'bn' ? 'অনুমোদন' : 'Approve'}</span>
                            </button>
                          )}
                          <Link
                            href={`/transfers/${tr.id}`}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-300 transition inline-flex items-center gap-1 text-[11px]"
                          >
                            <span>📋</span>
                            <span>{language === 'bn' ? 'বিস্তারিত →' : 'Details →'}</span>
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
