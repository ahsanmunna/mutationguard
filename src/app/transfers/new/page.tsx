'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';
import ConflictAlert from '@/components/ConflictAlert';
import StatusBadge from '@/components/StatusBadge';
import { Finding } from '@/lib/rules/types';
import { formatNumber, localName } from '@/lib/i18n/translations';

interface ParcelOption {
  id: string;
  current_owner_name: string;
  current_owner_nid: string;
  mouza: string;
  khatian: string;
  dag: string;
  area_decimal: number | string;
}

const DEFAULT_PARCELS: ParcelOption[] = [
  {
    id: 'P-001',
    current_owner_name: 'Rahim Uddin',
    current_owner_nid: 'NID-DEMO-0001',
    mouza: 'Dhanmondi-102',
    khatian: 'K-501',
    dag: 'D-1001',
    area_decimal: '5.00',
  },
  {
    id: 'P-002',
    current_owner_name: 'Abdul Maleque',
    current_owner_nid: 'NID-DEMO-0004',
    mouza: 'Gulshan-103',
    khatian: 'K-602',
    dag: 'D-2002',
    area_decimal: '8.50',
  },
  {
    id: 'P-003',
    current_owner_name: 'Nasima Akter',
    current_owner_nid: 'NID-DEMO-0005',
    mouza: 'Mirpur-104',
    khatian: 'K-703',
    dag: 'D-3003',
    area_decimal: '12.25',
  },
  {
    id: 'P-004',
    current_owner_name: 'Shamsul Haque',
    current_owner_nid: 'NID-DEMO-0006',
    mouza: 'Uttara-105',
    khatian: 'K-804',
    dag: 'D-4004',
    area_decimal: '3.75',
  },
];

function generateDeedNumber(): string {
  const random4 = Math.floor(1000 + Math.random() * 9000);
  return `DEED-2026-${random4}`;
}

export default function NewTransferPage() {
  const router = useRouter();
  const { language } = useLanguage();

  const [parcels, setParcels] = useState<ParcelOption[]>(DEFAULT_PARCELS);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Parcel & Buyer
    parcel_id: 'P-001',
    buyer_name: 'Karim Chowdhury',
    buyer_nid: 'NID-DEMO-0002',

    // Step 2: Deed Details
    deed_number: 'DEED-2026-1001',
    deed_date: '2026-01-15',
    seller_name: 'Rahim Uddin',
    seller_nid: 'NID-DEMO-0001',
    deed_mouza: 'Dhanmondi-102',
    deed_khatian: 'K-501',
    deed_dag: 'D-1001',
    deed_area_decimal: '5.00',

    // Step 3: Application Particulars
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

  // Fetch real parcels from server to keep current owners fresh
  useEffect(() => {
    async function loadParcels() {
      try {
        const res = await fetch('/api/parcels');
        const data = await res.json();
        if (data.parcels && Array.isArray(data.parcels) && data.parcels.length > 0) {
          setParcels(data.parcels);
        }
      } catch {
        // Fall back to default seed parcels
      }
    }
    loadParcels();
  }, []);

  // When parcel changes, prefill Deed & Application fields
  const handleParcelChange = (parcelId: string) => {
    const selected = parcels.find((p) => p.id === parcelId) || parcels[0];
    const newDeedNum = generateDeedNumber();
    setFormData((prev) => ({
      ...prev,
      parcel_id: selected.id,
      seller_name: selected.current_owner_name,
      seller_nid: selected.current_owner_nid,
      deed_number: newDeedNum,
      deed_mouza: selected.mouza,
      deed_khatian: selected.khatian,
      deed_dag: selected.dag,
      deed_area_decimal: String(selected.area_decimal),
      application_mouza: selected.mouza,
      application_khatian: selected.khatian,
      application_dag: selected.dag,
      application_area_decimal: String(selected.area_decimal),
    }));
  };

  // Preset demo scenarios
  const loadScenario = (type: string) => {
    switch (type) {
      case 'karim_clean':
        setFormData({
          parcel_id: 'P-001',
          deed_number: generateDeedNumber(),
          deed_date: '2026-01-15',
          seller_name: 'Rahim Uddin',
          seller_nid: 'NID-DEMO-0001',
          buyer_name: 'Karim Chowdhury',
          buyer_nid: 'NID-DEMO-0002',
          deed_mouza: 'Dhanmondi-102',
          deed_khatian: 'K-501',
          deed_dag: 'D-1001',
          deed_area_decimal: '5.00',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        });
        break;
      case 'hasan_double_sale':
        setFormData({
          parcel_id: 'P-001',
          deed_number: generateDeedNumber(),
          deed_date: '2026-01-16',
          seller_name: 'Rahim Uddin',
          seller_nid: 'NID-DEMO-0001',
          buyer_name: 'Hasan Mahmud',
          buyer_nid: 'NID-DEMO-0003',
          deed_mouza: 'Dhanmondi-102',
          deed_khatian: 'K-501',
          deed_dag: 'D-1001',
          deed_area_decimal: '5.00',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        });
        break;
      case 'p002_mismatch':
        setFormData({
          parcel_id: 'P-002',
          deed_number: generateDeedNumber(),
          deed_date: '2026-01-18',
          seller_name: 'Abdul Maleque',
          seller_nid: 'NID-DEMO-0004',
          buyer_name: 'Rafiqul Alam',
          buyer_nid: 'NID-DEMO-0009',
          deed_mouza: 'Gulshan-103',
          deed_khatian: 'K-602',
          deed_dag: 'D-2002',
          deed_area_decimal: '8.50',
          application_mouza: 'Gulshan-103',
          application_khatian: 'K-602',
          application_dag: 'D-2099', // Discrepancy
          application_area_decimal: '8.00', // Discrepancy
        });
        break;
      case 'wrong_seller':
        setFormData({
          parcel_id: 'P-001',
          deed_number: generateDeedNumber(),
          deed_date: '2026-01-20',
          seller_name: 'Rahim Uddin', // Invalid if Karim owns P-001
          seller_nid: 'NID-DEMO-0001',
          buyer_name: 'Zubair Hossain',
          buyer_nid: 'NID-DEMO-0010',
          deed_mouza: 'Dhanmondi-102',
          deed_khatian: 'K-501',
          deed_dag: 'D-1001',
          deed_area_decimal: '5.00',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        });
        break;
    }
    setCurrentStep(4);
  };

  const selectedParcel =
    parcels.find((p) => p.id === formData.parcel_id) || parcels[0];

  // Moving from Step 2 to Step 3 can auto-sync application fields if identical
  const handleProceedToStep3 = () => {
    setFormData((prev) => ({
      ...prev,
      application_mouza: prev.deed_mouza,
      application_khatian: prev.deed_khatian,
      application_dag: prev.deed_dag,
      application_area_decimal: prev.deed_area_decimal,
    }));
    setCurrentStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const payload = {
        parcel_id: formData.parcel_id,
        deed_number: formData.deed_number,
        seller_name: formData.seller_name,
        seller_nid: formData.seller_nid,
        buyer_name: formData.buyer_name,
        buyer_nid: formData.buyer_nid,
        application_mouza: formData.application_mouza,
        application_khatian: formData.application_khatian,
        application_dag: formData.application_dag,
        application_area_decimal: formData.application_area_decimal,
        deed_date: formData.deed_date,
      };

      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult({
          error: data.error || (language === 'bn' ? 'আবেদন দাখিলে ত্রুটি' : 'Failed to submit application'),
        });
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartNewApplication = () => {
    setResult(null);
    setCurrentStep(1);
    setFormData((prev) => ({
      ...prev,
      deed_number: generateDeedNumber(),
    }));
  };

  // Step Header Information
  const stepMeta = [
    {
      num: 1,
      titleBn: 'পার্সেল ও ক্রেতা',
      titleEn: 'Parcel & Buyer',
      icon: '📍',
    },
    {
      num: 2,
      titleBn: 'দলিলের বিবরণ',
      titleEn: 'Deed Details',
      icon: '📜',
    },
    {
      num: 3,
      titleBn: 'আবেদনের তথ্য',
      titleEn: 'Application Details',
      icon: '📝',
    },
    {
      num: 4,
      titleBn: 'পর্যালোচনা ও দাখিল',
      titleEn: 'Review & Submit',
      icon: '✓',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-1">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          {language === 'bn' ? 'নতুন নামজারি আবেদন' : 'Submit Mutation Application'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {language === 'bn'
            ? 'মোবাইল-বান্ধব ৪ ধাপের উইজার্ড। আবেদন দাখিলের সাথে সাথেই ৩টি নিরাপত্তা নীতি স্বয়ংক্রিয়ভাবে যাচাই হবে।'
            : 'Mobile-first 4-step wizard. Instant 3-rule conflict detection validates every submission.'}
        </p>
      </div>

      {/* Collapsed Legacy Presets Section */}
      <details className="p-3.5 sm:p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 group">
        <summary className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider cursor-pointer flex items-center justify-between select-none list-none">
          <span className="flex items-center gap-2">
            <span>⚡</span>
            <span>
              {language === 'bn'
                ? 'ডেমো মূল্যায়নের উদাহরণসমূহ (ক্লিক করে স্বয়ংক্রিয় পূরণ)'
                : 'Demo Evaluation Examples (Click to Auto-fill)'}
            </span>
          </span>
          <span className="text-slate-400 group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <div className="pt-2 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => loadScenario('karim_clean')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-slate-800 dark:text-slate-200 font-medium transition inline-flex items-center gap-1.5"
          >
            <span>🟢</span>
            <span>P-001 রহিম → করিম (সঠিক)</span>
          </button>
          <button
            type="button"
            onClick={() => loadScenario('hasan_double_sale')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-rose-500 text-slate-800 dark:text-slate-200 font-medium transition inline-flex items-center gap-1.5"
          >
            <span>🔴</span>
            <span>P-001 রহিম → হাসান (দ্বৈত হস্তান্তর)</span>
          </button>
          <button
            type="button"
            onClick={() => loadScenario('p002_mismatch')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-200 font-medium transition inline-flex items-center gap-1.5"
          >
            <span>🟡</span>
            <span>P-002 অমিল ডেমো (দাগ ও পরিমাণ)</span>
          </button>
          <button
            type="button"
            onClick={() => loadScenario('wrong_seller')}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-orange-500 text-slate-800 dark:text-slate-200 font-medium transition inline-flex items-center gap-1.5"
          >
            <span>🟠</span>
            <span>P-001 রহিম বিক্রয় (অননুমোদিত বিক্রেতা)</span>
          </button>
        </div>
      </details>

      {/* Submission Result View */}
      {result ? (
        <div className="space-y-4">
          {result.error ? (
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/80 border-2 border-rose-300 text-rose-900 dark:text-rose-200 text-sm font-semibold space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">❌</span>
                <span>{result.error}</span>
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                {language === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Try Again'}
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
                    {language === 'bn' ? 'আবেদন সফলভাবে গৃহীত হয়েছে' : 'Application Created Successfully'}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-black text-xl text-slate-900 dark:text-white">
                      {result.transfer_id}
                    </span>
                    {result.status && <StatusBadge status={result.status} size="sm" />}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => router.push(`/transfers/${result.transfer_id}`)}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition inline-flex items-center gap-1.5"
                  >
                    <span>🔍</span>
                    <span>{language === 'bn' ? 'বিস্তারিত ও টাইমলাইন →' : 'View Details & Timeline →'}</span>
                  </button>
                  <button
                    onClick={handleStartNewApplication}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition inline-flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span>{language === 'bn' ? 'আরেকটি আবেদন দাখিল' : 'Submit Another'}</span>
                  </button>
                </div>
              </div>

              {/* Conflict Findings or Clean Pass */}
              {result.findings && result.findings.length > 0 ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
                    <span className="text-lg">🛑</span>
                    <span>
                      {language === 'bn'
                        ? 'আবেদনে সংঘাত বা অসঙ্গতি সনাক্ত হওয়ায় এটি স্থগিত (Held) অবস্থায় রাখা হয়েছে।'
                        : 'Discrepancy detected. Transfer placed in Held state pending officer review.'}
                    </span>
                  </div>
                  <ConflictAlert findings={result.findings} />
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2.5">
                  <span className="text-xl">✅</span>
                  <div>
                    <p className="font-bold">
                      {language === 'bn'
                        ? 'নিরাপদ আবেদন — ৩টি নিয়মেই উত্তীর্ণ!'
                        : 'Clean Application — Passed All Rules!'}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {language === 'bn'
                        ? 'কোনো দ্বৈত হস্তান্তর বা দলিলের অমিল নেই। আবেদনটি সরাসরি যাচাইকৃত (Verified) হিসেবে অন্তর্ভুক্ত হয়েছে।'
                        : 'No double sale, wrong seller, or record mismatch detected. Successfully recorded as Verified.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Wizard Form Container */
        <div className="space-y-6">
          {/* Progress Indicator */}
          <nav aria-label="Progress" className="p-2 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3 text-center">
              {stepMeta.map((s) => {
                const isActive = currentStep === s.num;
                const isPassed = currentStep > s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => {
                      if (isPassed) setCurrentStep(s.num as any);
                    }}
                    disabled={!isPassed && !isActive}
                    className={`min-h-[44px] p-2 rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs font-bold ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isPassed
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border border-transparent cursor-not-allowed'
                    }`}
                  >
                    <span className="text-sm">
                      {isPassed ? '✓' : s.icon}
                    </span>
                    <span className="text-[11px] sm:text-xs truncate max-w-[80px] sm:max-w-none">
                      {language === 'bn' ? s.titleBn : s.titleEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Form Card */}
          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
          >
            {/* STEP 1: PARCEL & BUYER */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📍</span>
                    <span>
                      {language === 'bn'
                        ? 'ধাপ ১: জমির পার্সেল নির্বাচন ও ক্রেতার বিবরণ'
                        : 'Step 1: Select Parcel & Buyer Information'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'bn'
                      ? 'যে প্লটের জন্য নামজারি আবেদন করা হচ্ছে তা নির্বাচন করুন এবং ক্রেতার তথ্য দিন।'
                      : 'Choose the subject land parcel from the registry and provide the buyer details.'}
                  </p>
                </div>

                {/* Parcel Selection Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    {language === 'bn' ? 'জমির প্লট / পার্সেল নির্বাচন করুন *' : 'Select Land Parcel *'}
                  </label>
                  <select
                    value={formData.parcel_id}
                    onChange={(e) => handleParcelChange(e.target.value)}
                    className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    {parcels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.mouza} (খতিয়ান {p.khatian}, দাগ {p.dag}) — {formatNumber(p.area_decimal, language)} {language === 'bn' ? 'শতক' : 'Decimal'} — [মালিক: {localName(p.current_owner_name, language)}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Parcel Overview Box */}
                {selectedParcel && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                      {language === 'bn' ? 'রেজিস্ট্রি রেকর্ড অনুযায়ী বর্তমান মালিকানা:' : 'Recorded Land Registry Information:'}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span className="text-slate-500 block">{language === 'bn' ? 'মালিক:' : 'Owner:'}</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {localName(selectedParcel.current_owner_name, language)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{language === 'bn' ? 'এনআইডি:' : 'Owner NID:'}</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {selectedParcel.current_owner_nid}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{language === 'bn' ? 'মৌজা / দাগ:' : 'Mouza / Dag:'}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedParcel.mouza}, {selectedParcel.dag}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{language === 'bn' ? 'পরিমাণ:' : 'Area:'}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatNumber(selectedParcel.area_decimal, language)} {language === 'bn' ? 'শতক' : 'Decimal'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Buyer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'ক্রেতার নাম (Buyer Name) *' : 'Buyer Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.buyer_name}
                      onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Karim Chowdhury"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'ক্রেতার এনআইডি (Buyer NID) *' : 'Buyer NID *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.buyer_nid}
                      onChange={(e) => setFormData({ ...formData, buyer_nid: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 font-mono"
                      placeholder="NID-DEMO-0002"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow transition inline-flex items-center gap-2"
                  >
                    <span>{language === 'bn' ? 'পরবর্তী ধাপ (দলিল বিবরণ) →' : 'Next: Deed Details →'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: DEED DETAILS */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📜</span>
                    <span>
                      {language === 'bn'
                        ? 'ধাপ ২: সাব-রেজিস্ট্রি দলিলের বিবরণ'
                        : 'Step 2: Registered Deed Information'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'bn'
                      ? 'রেজিস্ট্রি রেকর্ড হতে স্বয়ংক্রিয় পূরণকৃত। প্রয়োজনে সম্পাদনাযোগ্য।'
                      : 'Prefilled from registry baseline. Editable to test conflict discrepancies.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'দলিল নম্বর *' : 'Deed Number *'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={formData.deed_number}
                        onChange={(e) => setFormData({ ...formData, deed_number: e.target.value })}
                        className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, deed_number: generateDeedNumber() })
                        }
                        className="min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition shrink-0"
                        title="Generate random deed number"
                      >
                        🎲 {language === 'bn' ? 'নতুন' : 'New'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'দলিলের তারিখ *' : 'Deed Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.deed_date}
                      onChange={(e) => setFormData({ ...formData, deed_date: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'দলিলে উল্লিখিত বিক্রেতার নাম *' : 'Seller Name on Deed *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.seller_name}
                      onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'বিক্রেতার এনআইডি *' : 'Seller NID on Deed *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.seller_nid}
                      onChange={(e) => setFormData({ ...formData, seller_nid: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'দলিলের মৌজা *' : 'Deed Mouza *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deed_mouza}
                      onChange={(e) => setFormData({ ...formData, deed_mouza: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'দলিলের খতিয়ান *' : 'Deed Khatian *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deed_khatian}
                      onChange={(e) => setFormData({ ...formData, deed_khatian: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'দলিলের দাগ *' : 'Deed Dag *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.deed_dag}
                      onChange={(e) => setFormData({ ...formData, deed_dag: e.target.value })}
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'দলিলের পরিমাণ (শতক) *' : 'Deed Area (Dec) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.deed_area_decimal}
                      onChange={(e) =>
                        setFormData({ ...formData, deed_area_decimal: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    ← {language === 'bn' ? 'পূর্ববর্তী' : 'Previous'}
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToStep3}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow transition inline-flex items-center gap-2"
                  >
                    <span>{language === 'bn' ? 'পরবর্তী ধাপ (আবেদন বিবরণ) →' : 'Next: Application Details →'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: APPLICATION DETAILS */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📝</span>
                    <span>
                      {language === 'bn'
                        ? 'ধাপ ৩: নামজারি আবেদনের বিবরণ'
                        : 'Step 3: Mutation Application Details'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'bn'
                      ? 'দলিল হতে স্বয়ংক্রিয়ভাবে অনুলিপিকৃত। অসঙ্গতি পরীক্ষার জন্য ইচ্ছাকৃত পরিবর্তন করতে পারেন।'
                      : 'Copied from deed. Modify only if intentionally testing RECORD_MISMATCH rule.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'আবেদনকৃত মৌজা *' : 'Application Mouza *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.application_mouza}
                      onChange={(e) =>
                        setFormData({ ...formData, application_mouza: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'আবেদনকৃত খতিয়ান *' : 'Application Khatian *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.application_khatian}
                      onChange={(e) =>
                        setFormData({ ...formData, application_khatian: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'আবেদনকৃত দাগ নং *' : 'Application Dag No *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.application_dag}
                      onChange={(e) =>
                        setFormData({ ...formData, application_dag: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {language === 'bn' ? 'জমির পরিমাণ (শতক) *' : 'Area Decimal *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.application_area_decimal}
                      onChange={(e) =>
                        setFormData({ ...formData, application_area_decimal: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    ← {language === 'bn' ? 'পূর্ববর্তী' : 'Previous'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow transition inline-flex items-center gap-2"
                  >
                    <span>{language === 'bn' ? 'পরবর্তী ধাপ (চূড়ান্ত পর্যালোচনা) →' : 'Next: Final Review →'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & SUBMIT */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>✓</span>
                    <span>
                      {language === 'bn'
                        ? 'ধাপ ৪: চূড়ান্ত পর্যালোচনা ও দাখিল'
                        : 'Step 4: Final Summary & Submission'}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'bn'
                      ? 'দাখিল করার পূর্বে সকল তথ্য মিলিয়ে নিন। সাবমিটের সাথে সাথে ৩টি নীতি স্বয়ংক্রিয়ভাবে যাচাই হবে।'
                      : 'Carefully review the mutation particulars before firing automated conflict verification.'}
                  </p>
                </div>

                {/* Review Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Card 1: Parcel & Registry */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                      {language === 'bn' ? '১. পার্সেল ও বিক্রেতা' : '1. Parcel & Seller Record'}
                    </span>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'প্লট আইডি:' : 'Parcel ID:'}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formData.parcel_id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'বিক্রেতার নাম:' : 'Seller Name:'}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {localName(formData.seller_name, language)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'বিক্রেতার এনআইডি:' : 'Seller NID:'}</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {formData.seller_nid}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Buyer */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                      {language === 'bn' ? '২. ক্রেতার তথ্য' : '2. Buyer / Transferee'}
                    </span>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'ক্রেতার নাম:' : 'Buyer Name:'}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {localName(formData.buyer_name, language)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'ক্রেতার এনআইডি:' : 'Buyer NID:'}</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {formData.buyer_nid}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Deed Details */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                      {language === 'bn' ? '৩. দলিলের বিবরণ' : '3. Deed Details'}
                    </span>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'দলিল নম্বর:' : 'Deed No:'}</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          {formData.deed_number}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'দলিলের তারিখ:' : 'Deed Date:'}</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {formData.deed_date}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'দলিলের পরিমাণ:' : 'Deed Area:'}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatNumber(formData.deed_area_decimal, language)} {language === 'bn' ? 'শতক' : 'Decimal'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Application Particulars */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] block">
                      {language === 'bn' ? '৪. নামজারি আবেদন' : '4. Mutation Application'}
                    </span>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'মৌজা ও দাগ:' : 'Mouza & Dag:'}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formData.application_mouza}, দাগ {formData.application_dag}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'খতিয়ান:' : 'Khatian:'}</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {formData.application_khatian}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">{language === 'bn' ? 'আবেদনকৃত জমি:' : 'Claimed Area:'}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatNumber(formData.application_area_decimal, language)} {language === 'bn' ? 'শতক' : 'Decimal'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={submitting}
                    className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    ← {language === 'bn' ? 'পূর্ববর্তী ধাপ' : 'Previous Step'}
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-[48px] w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-sm shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        <span>
                          {language === 'bn'
                            ? 'যাচাই ও দাখিল করা হচ্ছে...'
                            : 'Verifying & Submitting...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>
                          {language === 'bn'
                            ? 'আবেদন দাখিল ও নিরাপত্তা যাচাই করুন'
                            : 'Submit Application & Run Detection'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
