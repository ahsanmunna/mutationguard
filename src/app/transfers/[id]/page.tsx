'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import ConflictAlert from '@/components/ConflictAlert';
import { useLanguage } from '@/components/LanguageContext';

export default function TransferDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { t, language } = useLanguage();

  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTransfer = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/transfers/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load transfer');
      } else {
        setTransfer(data.transfer);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchTransfer();
  }, [id]);

  const handleTransition = async (targetStatus: string) => {
    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/transfers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to update status');
      } else {
        await fetchTransfer();
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">
        Loading transfer record #{id}...
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-rose-600 font-bold">Transfer not found: #{id}</p>
        <Link href="/dashboard" className="text-xs text-emerald-600 underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {transfer.id}
            </h1>
            <StatusBadge status={transfer.status} size="lg" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Submitted by <span className="font-semibold">{transfer.applicant_username}</span> on{' '}
            {new Date(transfer.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/verify/${transfer.id}`}
            className="px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-100 transition"
          >
            🔍 Public QR Certificate
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition"
          >
            ← Back
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs font-semibold">
          ❌ {errorMsg}
        </div>
      )}

      {/* Reviewer Action Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⚖️</span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {language === 'bn' ? 'ভূমি কর্মকর্তা / এসি ল্যান্ড অ্যাকশন প্যানেল' : 'Officer / AC Land Action Bar'}
            </span>
          </div>
          <span className="text-[11px] text-emerald-400 font-mono">
            Current Stage: {transfer.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {transfer.status === 'verified' && (
            <button
              onClick={() => handleTransition('under_review')}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition disabled:opacity-50"
            >
              Start Review (Under Review)
            </button>
          )}

          {transfer.status === 'under_review' && (
            <>
              <button
                onClick={() => handleTransition('approved')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Approve Transfer
              </button>
              <button
                onClick={() => handleTransition('held')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Put on Hold
              </button>
              <button
                onClick={() => handleTransition('rejected')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Reject Transfer
              </button>
            </>
          )}

          {transfer.status === 'held' && (
            <>
              <button
                onClick={() => handleTransition('under_review')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Move to Under Review
              </button>
              <button
                onClick={() => handleTransition('rejected')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}

          {transfer.status === 'approved' && (
            <>
              <button
                onClick={() => handleTransition('finalized')}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black transition disabled:opacity-50 shadow-md"
              >
                🏛️ Execute Atomic Finalization
              </button>
              <button
                onClick={() => handleTransition('rejected')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}

          {transfer.status === 'finalized' && (
            <div className="text-xs text-emerald-400 font-semibold py-1">
              ✓ Transfer finalized. Parcel ownership updated in official registry and immutable history recorded.
            </div>
          )}

          {transfer.status === 'rejected' && (
            <div className="text-xs text-rose-400 font-semibold py-1">
              ✕ Transfer rejected and closed.
            </div>
          )}
        </div>
      </div>

      {/* Findings Section */}
      <ConflictAlert findings={transfer.findings || []} />

      {/* Two Column Details: Deed vs Land Registry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deed Application Details */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>📄</span>
            <span>Deed & Application Particulars</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Deed Number:</span>
              <span className="font-mono font-semibold">{transfer.deed_number}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Seller:</span>
              <span className="font-semibold">{transfer.seller_name} ({transfer.seller_nid})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Buyer:</span>
              <span className="font-semibold">{transfer.buyer_name} ({transfer.buyer_nid})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Claimed Mouza:</span>
              <span className="font-semibold">{transfer.application_mouza}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Khatian / Dag:</span>
              <span className="font-semibold font-mono">
                {transfer.application_khatian} / {transfer.application_dag}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Area (Decimal):</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {transfer.application_area_decimal}
              </span>
            </div>
            <div className="pt-2">
              <span className="text-slate-500 block mb-1">Deed Anchor (SHA-256):</span>
              <div className="font-mono text-[10px] break-all bg-slate-100 dark:bg-slate-800 p-2 rounded">
                {transfer.deed_hash}
              </div>
            </div>
          </div>
        </div>

        {/* Official Registry Records */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <span>🏛️</span>
            <span>Official Land Registry Baseline</span>
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Parcel ID:</span>
              <span className="font-mono font-semibold">{transfer.parcel_id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Current Legal Owner:</span>
              <span className="font-semibold">
                {transfer.registry_owner_name} ({transfer.registry_owner_nid})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Registry Mouza:</span>
              <span className="font-semibold">{transfer.registry_mouza}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Registry Khatian / Dag:</span>
              <span className="font-semibold font-mono">
                {transfer.registry_khatian} / {transfer.registry_dag}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Registry Area (Decimal):</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {transfer.registry_area}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
