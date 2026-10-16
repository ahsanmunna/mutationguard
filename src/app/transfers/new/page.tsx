'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';
import ConflictAlert from '@/components/ConflictAlert';
import { Finding } from '@/lib/rules/types';

export default function NewTransferPage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [formData, setFormData] = useState({
    parcel_id: 'P-001',
    deed_number: 'DEED-2026-001',
    seller_name: 'Rahim Uddin',
    seller_nid: '1985000000001',
    buyer_name: 'Karim Chowdhury',
    buyer_nid: '1988000000002',
    application_mouza: 'Dhanmondi-102',
    application_khatian: 'K-501',
    application_dag: 'D-1001',
    application_area_decimal: '5.00',
  });

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    transfer_id?: string;
    status?: string;
    findings?: Finding[];
    error?: string;
  } | null>(null);

  // Preset demo scenarios for students
  const loadScenario = (type: string) => {
    switch (type) {
      case 'karim_clean':
        setFormData({
          parcel_id: 'P-001',
          deed_number: 'DEED-2026-001',
          seller_name: 'Rahim Uddin',
          seller_nid: '1985000000001',
          buyer_name: 'Karim Chowdhury',
          buyer_nid: '1988000000002',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        });
        break;
      case 'hasan_double_sale':
        setFormData({
          parcel_id: 'P-001',
          deed_number: 'DEED-2026-002',
          seller_name: 'Rahim Uddin',
          seller_nid: '1985000000001',
          buyer_name: 'Hasan Mahmud',
          buyer_nid: '1992000000003',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        });
        break;
      case 'p002_mismatch':
        setFormData({
          parcel_id: 'P-002',
          deed_number: 'DEED-2026-003',
          seller_name: 'Abdul Maleque',
          seller_nid: '1978000000004',
          buyer_name: 'Rafiqul Alam',
          buyer_nid: '1995000000009',
          application_mouza: 'Gulshan-103',
          application_khatian: 'K-602',
          application_dag: 'D-2099', // Mismatched dag (registry has D-2002)
          application_area_decimal: '8.00', // Mismatched area (registry has 8.50)
        });
        break;
      case 'wrong_seller':
        setFormData({
          parcel_id: 'P-001',
          deed_number: 'DEED-2026-004',
          seller_name: 'Rahim Uddin', // Invalid if Karim was finalized
          seller_nid: '1985000000001',
          buyer_name: 'Zubair Hossain',
          buyer_nid: '1997000000010',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        });
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error || 'Failed to submit application' });
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          {language === 'bn' ? 'নতুন নামজারি আবেদন দাখিল' : 'Submit Mutation Application'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {language === 'bn'
            ? 'আবেদন দাখিলের সাথে সাথেই ৩টি নিরাপত্তা নিয়ম স্বয়ংক্রিয়ভাবে যাচাই করা হবে।'
            : 'Automated 3-rule validation runs instantly upon submission to detect conflicting claims.'}
        </p>
      </div>

      {/* Preset Demo Quick-Fill Bar */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          ⚡ Demo Preset Scenarios (Click to Pre-fill Form):
        </span>
        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => loadScenario('karim_clean')}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-slate-800 dark:text-slate-200 font-medium transition"
          >
            🟢 P-001 Rahim → Karim (Clean)
          </button>
          <button
            type="button"
            onClick={() => loadScenario('hasan_double_sale')}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-rose-500 text-slate-800 dark:text-slate-200 font-medium transition"
          >
            🔴 P-001 Rahim → Hasan (Double Sale)
          </button>
          <button
            type="button"
            onClick={() => loadScenario('p002_mismatch')}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 font-medium transition"
          >
            🟡 P-002 (Record Mismatch Demo)
          </button>
          <button
            type="button"
            onClick={() => loadScenario('wrong_seller')}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-orange-500 text-slate-800 dark:text-slate-200 font-medium transition"
          >
            🟠 P-001 Rahim Sale (Wrong Seller)
          </button>
        </div>
      </div>

      {/* Submission Result / Conflict Alert */}
      {result && (
        <div className="space-y-4">
          {result.error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950 border border-rose-200 text-rose-800 dark:text-rose-200 text-sm font-semibold">
              ❌ {result.error}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Application Created: {result.transfer_id}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Initial Assigned Status:{' '}
                    <span className="font-bold uppercase text-emerald-600 dark:text-emerald-400">
                      {result.status}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/transfers/${result.transfer_id}`)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition"
                >
                  View Details & Timeline →
                </button>
              </div>

              {result.findings && result.findings.length > 0 ? (
                <ConflictAlert findings={result.findings} />
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                  ✅ Clean Application. Passed all three validation checks. Ready for officer review.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Parcel ID
            </label>
            <input
              type="text"
              required
              value={formData.parcel_id}
              onChange={(e) => setFormData({ ...formData, parcel_id: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deed Number
            </label>
            <input
              type="text"
              required
              value={formData.deed_number}
              onChange={(e) => setFormData({ ...formData, deed_number: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Seller Name
            </label>
            <input
              type="text"
              required
              value={formData.seller_name}
              onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Seller NID
            </label>
            <input
              type="text"
              required
              value={formData.seller_nid}
              onChange={(e) => setFormData({ ...formData, seller_nid: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Buyer Name
            </label>
            <input
              type="text"
              required
              value={formData.buyer_name}
              onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Buyer NID
            </label>
            <input
              type="text"
              required
              value={formData.buyer_nid}
              onChange={(e) => setFormData({ ...formData, buyer_nid: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mouza
            </label>
            <input
              type="text"
              required
              value={formData.application_mouza}
              onChange={(e) => setFormData({ ...formData, application_mouza: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Khatian
            </label>
            <input
              type="text"
              required
              value={formData.application_khatian}
              onChange={(e) => setFormData({ ...formData, application_khatian: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dag No
            </label>
            <input
              type="text"
              required
              value={formData.application_dag}
              onChange={(e) => setFormData({ ...formData, application_dag: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Area (Decimal)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.application_area_decimal}
              onChange={(e) =>
                setFormData({ ...formData, application_area_decimal: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition"
        >
          {submitting
            ? language === 'bn'
              ? 'যাচাই ও দাখিল করা হচ্ছে...'
              : 'Verifying & Submitting...'
            : language === 'bn'
            ? 'আবেদন দাখিল ও নিরাপত্তা যাচাই করুন'
            : 'Submit Application & Run Detection'}
        </button>
      </form>
    </div>
  );
}
