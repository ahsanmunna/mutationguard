'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { useLanguage } from '@/components/LanguageContext';

export default function DashboardPage() {
  const { t, language } = useLanguage();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

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

  const filteredTransfers = transfers.filter((tr) => {
    if (statusFilter === 'all') return true;
    return tr.status === statusFilter;
  });

  const countByStatus = (status: string) =>
    transfers.filter((t) => t.status === status).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            {language === 'bn' ? 'নামজারি আবেদন ও পর্যালোচনা ড্যাশবোর্ড' : 'Mutation Review Queue'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {language === 'bn'
              ? 'ভূমি কর্মকর্তা / এসি ল্যান্ডের পর্যালোচনা ও চূড়ান্ত নিষ্পত্তির তালিকা'
              : 'Official review queue for Assistant Commissioner (Land) and reviewing officers'}
          </p>
        </div>
        <Link
          href="/transfers/new"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition"
        >
          + {t('nav_submit')}
        </Link>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Applications</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {transfers.length}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Active / In Progress</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {countByStatus('verified') + countByStatus('under_review') + countByStatus('approved')}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-amber-600 dark:text-amber-400">Held (Conflicts)</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">
            {countByStatus('held')}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-blue-600 dark:text-blue-400">Finalized</p>
          <p className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1">
            {countByStatus('finalized')}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { key: 'all', label: language === 'bn' ? 'সকল' : 'All' },
          { key: 'verified', label: language === 'bn' ? 'যাচাইকৃত' : 'Verified' },
          { key: 'held', label: language === 'bn' ? 'স্থগিত (Held)' : 'Held' },
          { key: 'under_review', label: language === 'bn' ? 'পর্যালোচনাধীন' : 'Under Review' },
          { key: 'approved', label: language === 'bn' ? 'অনুমোদিত' : 'Approved' },
          { key: 'finalized', label: language === 'bn' ? 'চূড়ান্ত নিষ্পত্তিকৃত' : 'Finalized' },
          { key: 'rejected', label: language === 'bn' ? 'বাতিল' : 'Rejected' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === tab.key
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transfers Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {language === 'bn' ? 'তথ্য লোড হচ্ছে...' : 'Loading transfers...'}
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="text-3xl">📭</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {language === 'bn' ? 'কোনো নামজারি রেকর্ড পাওয়া যায়নি' : 'No transfers found'}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {language === 'bn'
                ? 'আবেদন দাখিল করতে বা ডেমো ডাটা দেখতে উপরে ক্লিক করুন।'
                : 'Submit a new transfer or use the demo panel to seed test records.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Transfer ID</th>
                  <th className="px-4 py-3">Parcel</th>
                  <th className="px-4 py-3">Buyer / Seller</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Findings</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
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
                      <td className="px-4 py-3 font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        <Link href={`/transfers/${tr.id}`} className="hover:underline">
                          {tr.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {tr.parcel_id}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {tr.application_mouza}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {tr.buyer_name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          from: {tr.seller_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={tr.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        {findingsCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-bold text-[11px]">
                            ⚠️ {findingsCount} finding(s)
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                            Clean ✓
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(tr.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/transfers/${tr.id}`}
                          className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-300 transition"
                        >
                          Review →
                        </Link>
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
