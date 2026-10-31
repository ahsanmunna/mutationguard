'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, ArrowLeft, RotateCcw, FileText, ChevronDown, Zap } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import ConflictAlert from '@/components/ConflictAlert';
import StatusBadge from '@/components/StatusBadge';
import { Field, Button, PageHeader } from '@/components/ui';
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
  const bn = language === 'bn';

  const [parcels, setParcels] = useState<ParcelOption[]>(DEFAULT_PARCELS);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

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
          seller_name: 'Rahim Uddin',
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
    setCurrentStep(3);
  };

  const selectedParcel =
    parcels.find((p) => p.id === formData.parcel_id) || parcels[0];

  // Moving from Step 2 to Step 3 auto-syncs application fields
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
          error: data.error || (bn ? 'আবেদন দাখিলে ত্রুটি হয়েছে' : 'Failed to submit application'),
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

  const steps = [
    { num: 1, titleBn: 'পার্সেল ও ক্রেতা', titleEn: 'Parcel & Buyer' },
    { num: 2, titleBn: 'দলিলের বিবরণ', titleEn: 'Deed Details' },
    { num: 3, titleBn: 'আবেদন ও পর্যালোচনা', titleEn: 'Application & Review' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title={bn ? 'নতুন নামজারি আবেদন' : 'Submit Mutation Application'}
        description={
          bn
            ? '৩-ধাপের প্রক্রিয়া। আবেদন দাখিলের সাথে সাথে ৩টি নীতি স্বয়ংক্রিয়ভাবে যাচাই হবে।'
            : '3-step wizard. Instant 3-rule conflict detection validates every submission.'
        }
      />

      {/* Collapsed Demo Evaluation Examples */}
      <details className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 group">
        <summary className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide cursor-pointer flex items-center justify-between select-none list-none">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span>
              {bn
                ? 'ডেমো মূল্যায়নের উদাহরণসমূহ (স্বয়ংক্রিয় পূরণ)'
                : 'Demo Evaluation Scenarios (Auto-fill)'}
            </span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" strokeWidth={1.75} aria-hidden="true" />
        </summary>
        <div className="pt-3 flex flex-wrap gap-2 text-xs">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => loadScenario('karim_clean')}
          >
            P-001 {bn ? 'রহিম → করিম (সঠিক)' : 'Rahim → Karim (Clean)'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => loadScenario('hasan_double_sale')}
          >
            P-001 {bn ? 'রহিম → হাসান (দ্বৈত হস্তান্তর)' : 'Rahim → Hasan (Double Sale)'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => loadScenario('p002_mismatch')}
          >
            P-002 {bn ? 'রেকর্ড অমিল (দাগ ও পরিমাণ)' : 'Record Mismatch (Dag & Area)'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => loadScenario('wrong_seller')}
          >
            P-001 {bn ? 'অননুমোদিত বিক্রেতা' : 'Unregistered Seller'}
          </Button>
        </div>
      </details>

      {/* Submission Result View */}
      {result ? (
        <div className="space-y-4">
          {result.error ? (
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-sm font-semibold space-y-3">
              <p>{result.error}</p>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setResult(null)}
              >
                {bn ? 'পুনরায় চেষ্টা করুন' : 'Try Again'}
              </Button>
            </div>
          ) : (
            <div className="p-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide block">
                    {bn ? 'আবেদন সফলভাবে গৃহীত হয়েছে' : 'Application Created Successfully'}
                  </span>
                  <div className="flex items-center gap-2.5 mt-1">
                    <span className="font-mono font-bold text-xl text-slate-900 dark:text-white">
                      {result.transfer_id}
                    </span>
                    {result.status && <StatusBadge status={result.status} size="sm" />}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => router.push(`/transfers/${result.transfer_id}`)}
                  >
                    {bn ? 'বিস্তারিত ও টাইমলাইন →' : 'View Details & Timeline →'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleStartNewApplication}
                    icon={<RotateCcw className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                  >
                    {bn ? 'আরেকটি আবেদন' : 'Submit Another'}
                  </Button>
                </div>
              </div>

              {/* Conflict Findings or Clean Pass */}
              <div className="space-y-3">
                <ConflictAlert findings={result.findings || []} />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Wizard Form Container */
        <div className="space-y-6">
          {/* Numbered Progress Line */}
          <nav aria-label="Progress" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 sm:p-3">
            <div className="grid grid-cols-3 gap-2">
              {steps.map((s) => {
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
                    className={`min-h-[44px] px-3 py-2 rounded-md transition-colors flex items-center justify-center gap-2 text-xs font-semibold ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : isPassed
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 border border-transparent cursor-not-allowed'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono shrink-0 border border-current">
                      {isPassed ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" /> : s.num}
                    </span>
                    <span className="truncate">{bn ? s.titleBn : s.titleEn}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Form Step Panel */}
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-6"
          >
            {/* STEP 1: PARCEL & BUYER */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {bn ? 'ধাপ ১: জমির পার্সেল নির্বাচন ও ক্রেতার বিবরণ' : 'Step 1: Select Parcel & Buyer Information'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {bn
                      ? 'যে প্লটের জন্য নামজারি আবেদন করা হচ্ছে তা নির্বাচন করুন এবং ক্রেতার তথ্য দিন।'
                      : 'Choose the subject land parcel from the registry and provide the buyer details.'}
                  </p>
                </div>

                {/* Parcel Selection Dropdown */}
                <Field
                  label={bn ? 'জমির প্লট / পার্সেল নির্বাচন করুন' : 'Select Land Parcel'}
                  htmlFor="parcel_id"
                  required
                >
                  <select
                    id="parcel_id"
                    value={formData.parcel_id}
                    onChange={(e) => handleParcelChange(e.target.value)}
                    className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {parcels.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.mouza} (খতিয়ান {p.khatian}, দাগ {p.dag}) — {formatNumber(p.area_decimal, language)} {bn ? 'শতক' : 'Decimal'} — [{bn ? 'মালিক:' : 'Owner:'} {localName(p.current_owner_name, language)}]
                      </option>
                    ))}
                  </select>
                </Field>

                {/* Selected Parcel Overview Box */}
                {selectedParcel && (
                  <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                    <span className="font-semibold text-slate-500 uppercase tracking-wide text-[11px] block">
                      {bn ? 'রেজিস্ট্রি রেকর্ড অনুযায়ী বর্তমান মালিকানা:' : 'Recorded Land Registry Information:'}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-500 block">{bn ? 'মালিক:' : 'Owner:'}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {localName(selectedParcel.current_owner_name, language)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{bn ? 'এনআইডি:' : 'Owner NID:'}</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          {selectedParcel.current_owner_nid}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{bn ? 'মৌজা / দাগ:' : 'Mouza / Dag:'}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {selectedParcel.mouza}, {selectedParcel.dag}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">{bn ? 'পরিমাণ:' : 'Area:'}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatNumber(selectedParcel.area_decimal, language)} {bn ? 'শতক' : 'Decimal'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Buyer Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label={bn ? 'ক্রেতার নাম (Buyer Name)' : 'Buyer Name'}
                    htmlFor="buyer_name"
                    required
                  >
                    <input
                      id="buyer_name"
                      type="text"
                      required
                      value={formData.buyer_name}
                      onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="e.g. Karim Chowdhury"
                    />
                  </Field>

                  <Field
                    label={bn ? 'ক্রেতার এনআইডি (Buyer NID)' : 'Buyer NID'}
                    htmlFor="buyer_nid"
                    required
                  >
                    <input
                      id="buyer_nid"
                      type="text"
                      required
                      value={formData.buyer_nid}
                      onChange={(e) => setFormData({ ...formData, buyer_nid: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      placeholder="NID-DEMO-0002"
                    />
                  </Field>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={() => setCurrentStep(2)}
                    className="w-full sm:w-auto"
                    icon={<ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                  >
                    {bn ? 'পরবর্তী: দলিলের বিবরণ' : 'Next: Deed Details'}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: DEED DETAILS */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {bn ? 'ধাপ ২: সাব-রেজিস্ট্রি দলিলের বিবরণ' : 'Step 2: Registered Deed Information'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {bn
                      ? 'রেজিস্ট্রি রেকর্ড হতে স্বয়ংক্রিয় পূরণকৃত। অসঙ্গতি পরীক্ষার জন্য সম্পাদনাযোগ্য।'
                      : 'Prefilled from registry baseline. Editable to test conflict discrepancies.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label={bn ? 'দলিল নম্বর' : 'Deed Number'}
                    htmlFor="deed_number"
                    required
                  >
                    <div className="flex gap-2">
                      <input
                        id="deed_number"
                        type="text"
                        required
                        value={formData.deed_number}
                        onChange={(e) => setFormData({ ...formData, deed_number: e.target.value })}
                        className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setFormData({ ...formData, deed_number: generateDeedNumber() })
                        }
                        title={bn ? 'নতুন এলোমেলো দলিল নম্বর তৈরি' : 'Generate random deed number'}
                      >
                        {bn ? 'নতুন' : 'New'}
                      </Button>
                    </div>
                  </Field>

                  <Field
                    label={bn ? 'দলিলের তারিখ' : 'Deed Date'}
                    htmlFor="deed_date"
                    required
                  >
                    <input
                      id="deed_date"
                      type="date"
                      required
                      value={formData.deed_date}
                      onChange={(e) => setFormData({ ...formData, deed_date: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label={bn ? 'দলিলে উল্লিখিত বিক্রেতার নাম' : 'Seller Name on Deed'}
                    htmlFor="seller_name"
                    required
                  >
                    <input
                      id="seller_name"
                      type="text"
                      required
                      value={formData.seller_name}
                      onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>

                  <Field
                    label={bn ? 'বিক্রেতার এনআইডি' : 'Seller NID on Deed'}
                    htmlFor="seller_nid"
                    required
                  >
                    <input
                      id="seller_nid"
                      type="text"
                      required
                      value={formData.seller_nid}
                      onChange={(e) => setFormData({ ...formData, seller_nid: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field
                    label={bn ? 'দলিলের মৌজা' : 'Deed Mouza'}
                    htmlFor="deed_mouza"
                    required
                  >
                    <input
                      id="deed_mouza"
                      type="text"
                      required
                      value={formData.deed_mouza}
                      onChange={(e) => setFormData({ ...formData, deed_mouza: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>

                  <Field
                    label={bn ? 'দলিলের খতিয়ান' : 'Deed Khatian'}
                    htmlFor="deed_khatian"
                    required
                  >
                    <input
                      id="deed_khatian"
                      type="text"
                      required
                      value={formData.deed_khatian}
                      onChange={(e) => setFormData({ ...formData, deed_khatian: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>

                  <Field
                    label={bn ? 'দলিলের দাগ' : 'Deed Dag'}
                    htmlFor="deed_dag"
                    required
                  >
                    <input
                      id="deed_dag"
                      type="text"
                      required
                      value={formData.deed_dag}
                      onChange={(e) => setFormData({ ...formData, deed_dag: e.target.value })}
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>

                  <Field
                    label={bn ? 'পরিমাণ (শতক)' : 'Area (Dec)'}
                    htmlFor="deed_area_decimal"
                    required
                  >
                    <input
                      id="deed_area_decimal"
                      type="number"
                      step="0.01"
                      required
                      value={formData.deed_area_decimal}
                      onChange={(e) =>
                        setFormData({ ...formData, deed_area_decimal: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setCurrentStep(1)}
                    className="w-full sm:w-auto"
                    icon={<ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                  >
                    {bn ? 'পূর্ববর্তী' : 'Previous'}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleProceedToStep3}
                    className="w-full sm:w-auto"
                    icon={<ArrowRight className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                  >
                    {bn ? 'পরবর্তী: আবেদনের বিবরণ' : 'Next: Application Details'}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: APPLICATION DETAILS & SUBMIT */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {bn ? 'ধাপ ৩: নামজারি আবেদনের বিবরণ ও দাখিল' : 'Step 3: Mutation Application Details & Submission'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {bn
                      ? 'দলিল হতে স্বয়ংক্রিয়ভাবে অনুলিপিকৃত। অসঙ্গতি পরীক্ষার জন্য ইচ্ছাকৃত পরিবর্তন করতে পারেন।'
                      : 'Copied from deed. Modify only if intentionally testing RECORD_MISMATCH rule.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Field
                    label={bn ? 'আবেদনকৃত মৌজা' : 'Application Mouza'}
                    htmlFor="application_mouza"
                    required
                  >
                    <input
                      id="application_mouza"
                      type="text"
                      required
                      value={formData.application_mouza}
                      onChange={(e) =>
                        setFormData({ ...formData, application_mouza: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>

                  <Field
                    label={bn ? 'আবেদনকৃত খতিয়ান' : 'Application Khatian'}
                    htmlFor="application_khatian"
                    required
                  >
                    <input
                      id="application_khatian"
                      type="text"
                      required
                      value={formData.application_khatian}
                      onChange={(e) =>
                        setFormData({ ...formData, application_khatian: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>

                  <Field
                    label={bn ? 'আবেদনকৃত দাগ নং' : 'Application Dag No'}
                    htmlFor="application_dag"
                    required
                  >
                    <input
                      id="application_dag"
                      type="text"
                      required
                      value={formData.application_dag}
                      onChange={(e) =>
                        setFormData({ ...formData, application_dag: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>

                  <Field
                    label={bn ? 'জমির পরিমাণ (শতক)' : 'Area Decimal'}
                    htmlFor="application_area_decimal"
                    required
                  >
                    <input
                      id="application_area_decimal"
                      type="number"
                      step="0.01"
                      required
                      value={formData.application_area_decimal}
                      onChange={(e) =>
                        setFormData({ ...formData, application_area_decimal: e.target.value })
                      }
                      className="min-h-[44px] w-full px-3 py-2 text-sm rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </Field>
                </div>

                {/* Summary Box */}
                <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <span className="font-semibold text-slate-500 uppercase tracking-wide text-[11px] block">
                    {bn ? 'দাখিলকৃত তথ্যের সারসংক্ষেপ:' : 'Application Summary Before Submission:'}
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-500 block">{bn ? 'প্লট আইডি:' : 'Parcel:'}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formData.parcel_id}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{bn ? 'বিক্রেতা:' : 'Seller:'}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{localName(formData.seller_name, language)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{bn ? 'ক্রেতা:' : 'Buyer:'}</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{localName(formData.buyer_name, language)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">{bn ? 'দলিল নম্বর:' : 'Deed No:'}</span>
                      <span className="font-mono text-slate-900 dark:text-white">{formData.deed_number}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setCurrentStep(2)}
                    disabled={submitting}
                    className="w-full sm:w-auto"
                    icon={<ArrowLeft className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                  >
                    {bn ? 'পূর্ববর্তী ধাপ' : 'Previous Step'}
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={submitting}
                    disabled={submitting}
                    className="w-full sm:w-auto"
                    icon={<FileText className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
                  >
                    {submitting
                      ? (bn ? 'যাচাই ও দাখিল করা হচ্ছে...' : 'Verifying & Submitting...')
                      : (bn ? 'আবেদন দাখিল ও নিরাপত্তা যাচাই' : 'Submit Application & Run Detection')}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
