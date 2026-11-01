'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RotateCcw,
  Play,
  Check,
  TriangleAlert,
  Loader2,
  Trash2,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import StatusBadge from '@/components/StatusBadge';
import ConflictAlert from '@/components/ConflictAlert';
import { Button, PageHeader } from '@/components/ui';
import { formatNumber } from '@/lib/i18n/translations';
import { Finding } from '@/lib/rules/types';

type ButtonStatus = 'idle' | 'loading' | 'success' | 'error';

interface ConcurrentResult {
  buyer_name: string;
  deed_number: string;
  transfer_id?: string;
  status?: string;
  findings?: Finding[];
  error?: string;
}

export default function DemoPage() {
  const router = useRouter();
  const { t, language } = useLanguage();
  const bn = language === 'bn';

  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<ButtonStatus>('idle');
  const [stepStatus, setStepStatus] = useState<Record<string, ButtonStatus>>({});
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [, setParcels] = useState<any[]>([]);

  // Concurrent Race Test State
  const [concurrentState, setConcurrentState] = useState<ButtonStatus>('idle');
  const [concurrentResults, setConcurrentResults] = useState<{
    karim: ConcurrentResult | null;
    hasan: ConcurrentResult | null;
  } | null>(null);

  const fetchParcels = async () => {
    try {
      const res = await fetch('/api/parcels');
      const data = await res.json();
      if (data.parcels) setParcels(data.parcels);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  const addLog = (msg: string) => {
    setStatusLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const setSingleStepStatus = (stepKey: string, status: ButtonStatus) => {
    setStepStatus((prev) => ({ ...prev, [stepKey]: status }));
  };

  const handleResetDemoData = async () => {
    const confirmMsg = bn
      ? 'আপনি কি নিশ্চিত যে সমস্ত টেস্ট ডেটা প্রাথমিক সিড অবস্থায় রিসেট করতে চান?'
      : 'Are you sure you want to reset all test data back to the clean seed state?';
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      setResetting(true);
      setResetStatus('loading');
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setResetStatus('success');
        setStepStatus({});
        setStatusLog([]);
        setConcurrentState('idle');
        setConcurrentResults(null);
        await fetchParcels();
        addLog(
          bn
            ? '[OK] ডাটাবেস সফলভাবে প্রাথমিক সিড অবস্থায় রিসেট করা হয়েছে।'
            : '[OK] Database successfully reset to pristine seed baseline.'
        );
      } else {
        setResetStatus('error');
        addLog(
          bn
            ? `[ERROR] রিসেট ব্যর্থ হয়েছে: ${data.error}`
            : `[ERROR] Reset failed: ${data.error}`
        );
      }
    } catch (err: any) {
      setResetStatus('error');
      addLog(
        bn
          ? `[ERROR] রিসেট ত্রুটি: ${err.message}`
          : `[ERROR] Reset error: ${err.message}`
      );
    } finally {
      setResetting(false);
      setTimeout(() => setResetStatus('idle'), 3000);
    }
  };

  // Concurrent Conflict Test: Fire Karim and Hasan simultaneously
  const runConcurrentConflictTest = async () => {
    setConcurrentState('loading');
    setConcurrentResults(null);
    addLog(
      bn
        ? '[CONCURRENT] কনকারেন্সি পরীক্ষা শুরু: P-001 এর জন্য একসাথে ২টি আবেদন পাঠানো হচ্ছে (করিম ও হাসান)...'
        : '[CONCURRENT] Firing two conflicting transfer requests concurrently for parcel P-001 (Karim vs Hasan)...'
    );

    const karimBody = {
      parcel_id: 'P-001',
      deed_number: 'DEED-2026-001',
      seller_name: 'Rahim Uddin',
      seller_nid: 'NID-DEMO-0001',
      buyer_name: 'Karim Chowdhury',
      buyer_nid: 'NID-DEMO-0002',
      application_mouza: 'Dhanmondi-102',
      application_khatian: 'K-501',
      application_dag: 'D-1001',
      application_area_decimal: '5.00',
    };

    const hasanBody = {
      parcel_id: 'P-001',
      deed_number: 'DEED-2026-002',
      seller_name: 'Rahim Uddin',
      seller_nid: 'NID-DEMO-0001',
      buyer_name: 'Hasan Mahmud',
      buyer_nid: 'NID-DEMO-0003',
      application_mouza: 'Dhanmondi-102',
      application_khatian: 'K-501',
      application_dag: 'D-1001',
      application_area_decimal: '5.00',
    };

    try {
      const [resKarim, resHasan] = await Promise.all([
        fetch('/api/transfers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(karimBody),
        }),
        fetch('/api/transfers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(hasanBody),
        }),
      ]);

      const dataKarim = await resKarim.json();
      const dataHasan = await resHasan.json();

      const karimParsed: ConcurrentResult = {
        buyer_name: 'Karim Chowdhury',
        deed_number: 'DEED-2026-001',
        transfer_id: dataKarim.transfer_id,
        status: dataKarim.status,
        findings: dataKarim.findings,
        error: !resKarim.ok ? dataKarim.error : undefined,
      };

      const hasanParsed: ConcurrentResult = {
        buyer_name: 'Hasan Mahmud',
        deed_number: 'DEED-2026-002',
        transfer_id: dataHasan.transfer_id,
        status: dataHasan.status,
        findings: dataHasan.findings,
        error: !resHasan.ok ? dataHasan.error : undefined,
      };

      setConcurrentResults({
        karim: karimParsed,
        hasan: hasanParsed,
      });

      setConcurrentState('success');
      addLog(
        bn
          ? `[CONCURRENT] ফলাফল: করিম (${karimParsed.transfer_id || 'ত্রুটি'}) -> স্ট্যাটাস "${karimParsed.status || 'ব্যর্থ'}", হাসান (${hasanParsed.transfer_id || 'ত্রুটি'}) -> স্ট্যাটাস "${hasanParsed.status || 'ব্যর্থ'}"`
          : `[CONCURRENT] Result: Karim (${karimParsed.transfer_id || 'err'}) -> status "${karimParsed.status || 'failed'}", Hasan (${hasanParsed.transfer_id || 'err'}) -> status "${hasanParsed.status || 'failed'}"`
      );
      await fetchParcels();
    } catch (err: any) {
      setConcurrentState('error');
      addLog(
        bn
          ? `[ERROR] কনকারেন্সি পরীক্ষা ব্যর্থ হয়েছে: ${err.message}`
          : `[ERROR] Concurrency test failed: ${err.message}`
      );
    }
  };

  // Demo Step 1: Submit Rahim -> Karim (P-001)
  const runStep1_KarimClean = async () => {
    setSingleStepStatus('step1', 'loading');
    try {
      addLog(
        bn
          ? 'ধাপ ১: P-001 এর জন্য সঠিক আবেদন দাখিল (রহিম উদ্দিন → করিম চৌধুরী)...'
          : 'Step 1: Submitting clean transfer for P-001 (Rahim Uddin → Karim Chowdhury)...'
      );
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcel_id: 'P-001',
          deed_number: 'DEED-2026-001',
          seller_name: 'Rahim Uddin',
          seller_nid: 'NID-DEMO-0001',
          buyer_name: 'Karim Chowdhury',
          buyer_nid: 'NID-DEMO-0002',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step1', 'success');
        addLog(
          bn
            ? `[OK] ধাপ ১ সফল: আবেদন ${data.transfer_id} তৈরি হয়েছে স্ট্যাটাস "${data.status}" সহ। (সক্রিয় হস্তান্তর প্রতিষ্ঠিত)`
            : `[OK] Step 1 Success: Transfer ${data.transfer_id} created with status "${data.status}". (Active transfer established)`
        );
        await fetchParcels();
      } else {
        setSingleStepStatus('step1', 'error');
        addLog(
          bn
            ? `[ERROR] ধাপ ১ ত্রুটি: ${data.error}`
            : `[ERROR] Step 1 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step1', 'error');
      addLog(
        bn
          ? `[ERROR] ধাপ ১ ত্রুটি: ${err.message}`
          : `[ERROR] Step 1 Error: ${err.message}`
      );
    }
  };

  // Demo Step 2: Submit Rahim -> Hasan (P-001) - Must be held as DOUBLE_SALE
  const runStep2_HasanDoubleSale = async () => {
    setSingleStepStatus('step2', 'loading');
    try {
      addLog(
        bn
          ? 'ধাপ ২: P-001 এর জন্য সংঘাতপূর্ণ দ্বিতীয় আবেদন দাখিল (রহিম উদ্দিন → হাসান মাহমুদ)...'
          : 'Step 2: Submitting conflicting transfer for P-001 (Rahim Uddin → Hasan Mahmud)...'
      );
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcel_id: 'P-001',
          deed_number: 'DEED-2026-002',
          seller_name: 'Rahim Uddin',
          seller_nid: 'NID-DEMO-0001',
          buyer_name: 'Hasan Mahmud',
          buyer_nid: 'NID-DEMO-0003',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step2', 'success');
        addLog(
          bn
            ? `[HELD] ধাপ ২ সনাক্ত: আবেদন ${data.transfer_id} দ্বৈত হস্তান্তরের কারণে "${data.status}" অবস্থায় রাখা হয়েছে।`
            : `[HELD] Step 2 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with DOUBLE_SALE finding.`
        );
      } else {
        setSingleStepStatus('step2', 'error');
        addLog(
          bn
            ? `[ERROR] ধাপ ২ ত্রুটি: ${data.error}`
            : `[ERROR] Step 2 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step2', 'error');
      addLog(
        bn
          ? `[ERROR] ধাপ ২ ত্রুটি: ${err.message}`
          : `[ERROR] Step 2 Error: ${err.message}`
      );
    }
  };

  // Demo Step 3: Finalize Karim
  const runStep3_FinalizeKarim = async () => {
    setSingleStepStatus('step3', 'loading');
    try {
      addLog(
        bn
          ? 'ধাপ ৩: P-001 এ করিম চৌধুরীর সক্রিয় আবেদন অনুসন্ধান ও চূড়ান্ত নিষ্পত্তি...'
          : 'Step 3: Finding Karim Chowdhury active transfer on P-001 to approve & finalize...'
      );
      const listRes = await fetch('/api/transfers?parcel_id=P-001');
      const listData = await listRes.json();

      // Pick Karim's ACTIVE transfer (not a held/rejected one from an earlier run).
      const karimTr = listData.transfers?.find(
        (t: any) =>
          t.buyer_name === 'Karim Chowdhury' && ['verified', 'under_review', 'approved'].includes(t.status)
      );
      if (!karimTr) {
        setSingleStepStatus('step3', 'error');
        addLog(
          bn
            ? '[ERROR] করিম চৌধুরীর আবেদন পাওয়া যায়নি। অনুগ্রহ করে প্রথমে ধাপ ১ সম্পন্ন করুন।'
            : '[ERROR] Karim transfer not found. Please run Step 1 first.'
        );
        return;
      }

      // Move through the stages one at a time. Stop at the first step the server refuses,
      // so the real reason is shown instead of being ignored.
      const stages =
        karimTr.status === 'verified'
          ? ['under_review', 'approved', 'finalized']
          : karimTr.status === 'under_review'
          ? ['approved', 'finalized']
          : ['finalized'];
      let finRes!: Response;
      let finData: any = null;
      for (const stage of stages) {
        finRes = await fetch(`/api/transfers/${karimTr.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: stage }),
        });
        finData = await finRes.json();
        if (!finRes.ok) break;
      }
      if (finRes.ok) {
        setSingleStepStatus('step3', 'success');
        addLog(
          bn
            ? '[FINALIZED] ধাপ ৩ নিষ্পত্তি সম্পন্ন: করিম চৌধুরী এখন P-001 এর বৈধ নিবন্ধিত মালিক। রেজিস্ট্রি ও মালিকানা ইতিহাস আপডেট হয়েছে।'
            : '[FINALIZED] Step 3 Finalization Complete: Karim is now legal owner of P-001. Registry and ownership history atomically updated.'
        );
        await fetchParcels();
      } else {
        setSingleStepStatus('step3', 'error');
        addLog(
          bn
            ? `[ERROR] চূড়ান্ত নিষ্পত্তি ত্রুটি: ${finData.error}`
            : `[ERROR] Finalization Error: ${finData.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step3', 'error');
      addLog(
        bn
          ? `[ERROR] চূড়ান্ত নিষ্পত্তি ত্রুটি: ${err.message}`
          : `[ERROR] Finalization Error: ${err.message}`
      );
    }
  };

  // Demo Step 4: Subsequent Rahim Sale (WRONG_SELLER)
  const runStep4_WrongSeller = async () => {
    setSingleStepStatus('step4', 'loading');
    try {
      addLog(
        bn
          ? 'ধাপ ৪: P-001 এ রহিম কর্তৃক নতুন আবেদন দাখিল (করিম এখন মালিক হওয়ায় এটি অননুমোদিত বিক্রেতা)...'
          : 'Step 4: Submitting subsequent sale on P-001 with Rahim as seller (Now invalid since Karim is owner)...'
      );
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcel_id: 'P-001',
          deed_number: 'DEED-2026-004',
          seller_name: 'Rahim Uddin',
          seller_nid: 'NID-DEMO-0001',
          buyer_name: 'Zubair Hossain',
          buyer_nid: 'NID-DEMO-0010',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step4', 'success');
        addLog(
          bn
            ? `[HELD] ধাপ ৪ সনাক্ত: আবেদন ${data.transfer_id} অননুমোদিত বিক্রেতা সনাক্ত হওয়ায় "${data.status}" অবস্থায় রাখা হয়েছে!`
            : `[HELD] Step 4 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with WRONG_SELLER finding!`
        );
      } else {
        setSingleStepStatus('step4', 'error');
        addLog(
          bn
            ? `[ERROR] ধাপ ৪ ত্রুটি: ${data.error}`
            : `[ERROR] Step 4 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step4', 'error');
      addLog(
        bn
          ? `[ERROR] ধাপ ৪ ত্রুটি: ${err.message}`
          : `[ERROR] Step 4 Error: ${err.message}`
      );
    }
  };

  // Demo Step 5: P-002 Record Mismatch Demo
  const runStep5_RecordMismatch = async () => {
    setSingleStepStatus('step5', 'loading');
    try {
      addLog(
        bn
          ? 'ধাপ ৫: P-002 এ ইচ্ছাকৃত দাগ ও পরিমাণের অমিলসহ আবেদন দাখিল...'
          : 'Step 5: Submitting P-002 mutation with deliberate Dag & Area discrepancies...'
      );
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcel_id: 'P-002',
          deed_number: 'DEED-2026-003',
          seller_name: 'Abdul Maleque',
          seller_nid: 'NID-DEMO-0004',
          buyer_name: 'Rafiqul Alam',
          buyer_nid: 'NID-DEMO-0009',
          application_mouza: 'Gulshan-103',
          application_khatian: 'K-602',
          application_dag: 'D-2099', // Discrepancy
          application_area_decimal: '8.00', // Discrepancy
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step5', 'success');
        addLog(
          bn
            ? `[HELD] ধাপ ৫ সনাক্ত: আবেদন ${data.transfer_id} তথ্যের অমিলে "${data.status}" অবস্থায় রাখা হয়েছে!`
            : `[HELD] Step 5 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with RECORD_MISMATCH detailing all differing fields!`
        );
      } else {
        setSingleStepStatus('step5', 'error');
        addLog(
          bn
            ? `[ERROR] ধাপ ৫ ত্রুটি: ${data.error}`
            : `[ERROR] Step 5 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step5', 'error');
      addLog(
        bn
          ? `[ERROR] ধাপ ৫ ত্রুটি: ${err.message}`
          : `[ERROR] Step 5 Error: ${err.message}`
      );
    }
  };

  // Status line helper with icon + text (never color alone)
  const renderStepStatus = (status: ButtonStatus) => {
    if (status === 'loading') {
      return (
        <span className="inline-flex items-center gap-1 text-slate-500 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          <span>{bn ? 'চলছে...' : 'Running...'}</span>
        </span>
      );
    }
    if (status === 'success') {
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
          <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden="true" />
          <span>{bn ? 'সম্পন্ন' : 'Completed'}</span>
        </span>
      );
    }
    if (status === 'error') {
      return (
        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-medium">
          <TriangleAlert className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />
          <span>{bn ? 'ব্যর্থ' : 'Failed'}</span>
        </span>
      );
    }
    return (
      <span className="text-slate-400 text-[11px]">
        {bn ? 'অপেক্ষমাণ' : 'Pending'}
      </span>
    );
  };

  const isAnyStepRunning =
    Object.values(stepStatus).some((s) => s === 'loading') ||
    concurrentState === 'loading' ||
    resetting;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <PageHeader
        title={t('demo_title')}
        description={t('demo_subtitle')}
      />

      {/* SECTION 1: RESET */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">
              {bn ? '১. ডাটাবেস রিসেট' : '1. Database Reset'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {bn
                ? 'সমস্ত টেস্ট রেকর্ড মুছে ডাটাবেসকে প্রাথমিক পরিষ্কার সিড অবস্থায় ফিরিয়ে নেয়।'
                : 'Resets all demo transfers and ownership changes back to clean seed state.'}
            </p>
          </div>

          <Button
            variant="secondary"
            size="md"
            loading={resetStatus === 'loading'}
            disabled={isAnyStepRunning}
            onClick={handleResetDemoData}
            icon={<RotateCcw className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
          >
            {resetStatus === 'loading'
              ? t('demo_resetting')
              : resetStatus === 'success'
              ? (bn ? 'রিসেট সম্পন্ন' : 'Reset Complete')
              : t('demo_reset_btn')}
          </Button>
        </div>
      </section>

      {/* SECTION 2: SCENARIO STEPS 1-5 & CONCURRENCY TEST */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 pb-2">
          {bn ? '২. ডেমো পরিস্থিতি ও ধাপসমূহ (১-৫)' : '2. Guided Scenario Steps (1-5)'}
        </h2>

        {/* Concurrent Race Test Block */}
        <div className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {bn
                    ? 'কনকারেন্সি পরীক্ষা: একসাথে দুটি সংঘাতপূর্ণ অনুরোধ'
                    : 'Concurrency Test: Simultaneous Conflicting Submissions'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t('demo_concurrent_hint')}
              </p>
            </div>

            <Button
              variant="secondary"
              size="md"
              loading={concurrentState === 'loading'}
              disabled={isAnyStepRunning}
              onClick={runConcurrentConflictTest}
              icon={<Play className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />}
            >
              {concurrentState === 'loading'
                ? (bn ? 'অনুরোধ পাঠানো হচ্ছে...' : 'Firing concurrent requests...')
                : t('demo_concurrent_btn')}
            </Button>
          </div>

          {/* Side-by-Side Results: Active vs Held */}
          {concurrentResults && (
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {bn ? 'পাশাপাশি ফলাফল তুলনা:' : 'Side-by-Side Results:'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Result 1: Karim */}
                <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {bn ? 'অনুরোধ ১: করিম চৌধুরী' : 'Request 1: Karim Chowdhury'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {concurrentResults.karim?.deed_number} • NID-DEMO-0002
                      </span>
                    </div>
                    {concurrentResults.karim?.status && (
                      <StatusBadge status={concurrentResults.karim.status} size="sm" />
                    )}
                  </div>
                  {concurrentResults.karim?.transfer_id && (
                    <p className="font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                      ID: {concurrentResults.karim.transfer_id}
                    </p>
                  )}
                  {concurrentResults.karim?.status === 'verified' && (
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                      {bn
                        ? 'লক আগে পেয়ে সক্রিয় যাচাইকৃত আবেদন হিসেবে গৃহীত হয়েছে।'
                        : 'Acquired write lock first and recorded as active verified transfer.'}
                    </p>
                  )}
                </div>

                {/* Result 2: Hasan */}
                <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {bn ? 'অনুরোধ ২: হাসান মাহমুদ' : 'Request 2: Hasan Mahmud'}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {concurrentResults.hasan?.deed_number} • NID-DEMO-0003
                      </span>
                    </div>
                    {concurrentResults.hasan?.status && (
                      <StatusBadge status={concurrentResults.hasan.status} size="sm" />
                    )}
                  </div>
                  {concurrentResults.hasan?.transfer_id && (
                    <p className="font-mono text-amber-700 dark:text-amber-400 font-semibold">
                      ID: {concurrentResults.hasan.transfer_id}
                    </p>
                  )}
                  {concurrentResults.hasan?.status === 'held' && (
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      {bn
                        ? 'একই প্লটে পূর্বে সক্রিয় আবেদন থাকায় স্বয়ংক্রিয়ভাবে স্থগিত (held) করা হয়েছে।'
                        : 'DOUBLE_SALE rule caught the conflicting claim and held the application.'}
                    </p>
                  )}
                  {concurrentResults.hasan?.findings && (
                    <div className="pt-2">
                      <ConflictAlert findings={concurrentResults.hasan.findings} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Steps 1 to 5 List */}
        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden text-xs">
          {/* Step 1 */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {bn ? '১. রহিম → করিম (সঠিক হস্তান্তর)' : '1. Rahim → Karim (Clean Transfer)'}
                </span>
                <span className="text-slate-400">·</span>
                {renderStepStatus(stepStatus['step1'] || 'idle')}
              </div>
              <p className="text-slate-500">
                {bn
                  ? 'প্রাথমিক দাখিল সমস্ত যাচাইকরণ উত্তীর্ণ হয়ে "যাচাইকৃত" সক্রিয় অবস্থায় প্রবেশ করে।'
                  : 'Initial submission passes all checks and enters "verified" active state.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={stepStatus['step1'] === 'loading'}
              disabled={isAnyStepRunning}
              onClick={runStep1_KarimClean}
              icon={<Play className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />}
            >
              {bn ? 'চালান' : 'Execute'}
            </Button>
          </div>

          {/* Step 2 */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {bn ? '২. রহিম → হাসান (দ্বৈত হস্তান্তর)' : '2. Rahim → Hasan (Double Sale)'}
                </span>
                <span className="text-slate-400">·</span>
                {renderStepStatus(stepStatus['step2'] || 'idle')}
              </div>
              <p className="text-slate-500">
                {bn
                  ? 'P-001 এ সক্রিয় আবেদন থাকায় স্বয়ংক্রিয়ভাবে স্থগিত (held) করা হয়।'
                  : 'Detected and held automatically due to existing active transfer on P-001.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={stepStatus['step2'] === 'loading'}
              disabled={isAnyStepRunning}
              onClick={runStep2_HasanDoubleSale}
              icon={<Play className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />}
            >
              {bn ? 'চালান' : 'Execute'}
            </Button>
          </div>

          {/* Step 3 */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {bn ? '৩. করিম চৌধুরীর চূড়ান্ত নিষ্পত্তি' : '3. Finalize Karim Chowdhury'}
                </span>
                <span className="text-slate-400">·</span>
                {renderStepStatus(stepStatus['step3'] || 'idle')}
              </div>
              <p className="text-slate-500">
                {bn
                  ? 'অনুমোদন ও চূড়ান্ত নিষ্পত্তি। মালিকানা করিমে পরিবর্তিত হয় এবং অডিট ব্লক রেকর্ড করে।'
                  : 'Approve and finalize. Updates legal owner to Karim and records audit block.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={stepStatus['step3'] === 'loading'}
              disabled={isAnyStepRunning}
              onClick={runStep3_FinalizeKarim}
              icon={<Play className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />}
            >
              {bn ? 'চূড়ান্ত নিষ্পত্তি' : 'Finalize'}
            </Button>
          </div>

          {/* Step 4 */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {bn ? '৪. রহিমের পরবর্তী বিক্রয় (অননুমোদিত বিক্রেতা)' : '4. Subsequent Rahim Sale (Wrong Seller)'}
                </span>
                <span className="text-slate-400">·</span>
                {renderStepStatus(stepStatus['step4'] || 'idle')}
              </div>
              <p className="text-slate-500">
                {bn
                  ? 'ব্যর্থ হয় কারণ রহিম আর P-001 এর বৈধ নিবন্ধিত মালিক নন।'
                  : 'Fails because Rahim is no longer recorded owner of P-001.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={stepStatus['step4'] === 'loading'}
              disabled={isAnyStepRunning}
              onClick={runStep4_WrongSeller}
              icon={<Play className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />}
            >
              {bn ? 'চালান' : 'Execute'}
            </Button>
          </div>

          {/* Step 5 */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {bn ? '৫. P-002 রেকর্ডের অমিল ডেমো' : '5. Record Mismatch Demo on P-002'}
                </span>
                <span className="text-slate-400">·</span>
                {renderStepStatus(stepStatus['step5'] || 'idle')}
              </div>
              <p className="text-slate-500">
                {bn
                  ? 'ভুল দাগ ও পরিমাণের আবেদন দাখিল। সকল অসঙ্গতি স্পষ্টভাবে প্রদর্শন করে।'
                  : 'Submits mismatched Dag & Area. Reports all differing fields cleanly.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={stepStatus['step5'] === 'loading'}
              disabled={isAnyStepRunning}
              onClick={runStep5_RecordMismatch}
              icon={<Play className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />}
            >
              {bn ? 'চালান' : 'Execute'}
            </Button>
          </div>
        </div>
      </section>

      {/* SECTION 3: INTEGRITY & REVIEW TOOLS */}
      <section className="p-5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide border-b border-slate-200 dark:border-slate-800 pb-2">
          {bn ? '৩. নিরীক্ষা ও কিউ টুলস' : '3. Integrity & Review Tools'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
            <span className="font-bold text-slate-900 dark:text-white block">
              {bn ? 'অডিট চেইনের অখণ্ডতা নিরীক্ষক' : 'Audit Chain Integrity Checker'}
            </span>
            <p className="text-slate-500">
              {bn
                ? 'ক্রিপ্টোগ্রাফিক লেজার ব্লক পরীক্ষা, Ed25519 ডিজিটাল স্বাক্ষর যাচাই অথবা টেম্পারিং টেস্ট।'
                : 'Inspect cryptographic ledger blocks, verify Ed25519 signatures, or inject tampering.'}
            </p>
            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/integrity')}
                icon={<ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />}
              >
                {bn ? 'নিরীক্ষক খুলুন' : 'Open Auditor'}
              </Button>
            </div>
          </div>

          <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-2">
            <span className="font-bold text-slate-900 dark:text-white block">
              {bn ? 'পর্যালোচনা কিউ ও আবেদন তালিকা' : 'Review Queue & Applications Table'}
            </span>
            <p className="text-slate-500">
              {bn
                ? 'স্ট্যাটাস ফিল্টার ও সক্রিয় ওয়ার্কফ্লো অ্যাকশনসহ বর্তমান কিউ দেখুন।'
                : 'View current review queue with status filters and active workflow actions.'}
            </p>
            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/dashboard')}
                icon={<ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />}
              >
                {bn ? 'কিউ খুলুন' : 'Open Queue'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* REALTIME EXECUTION LOG CONSOLE (No emojis, mono text, bg-slate-950) */}
      <section className="p-4 sm:p-5 rounded-lg bg-slate-950 text-slate-200 border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-semibold text-slate-400">
            {bn ? 'এক্সিকিউশন লগ কনসোল' : 'Execution Log Console'}
          </span>
          <button
            onClick={() => setStatusLog([])}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />
            <span>{bn ? 'লগ মুছুন' : 'Clear Log'}</span>
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1 text-[11px]">
          {statusLog.length === 0 ? (
            <p className="text-slate-600 italic">
              {bn
                ? 'এখনো কোনো পদক্ষেপ চালানো হয়নি। উপরের যেকোনো বোতামে ক্লিক করুন।'
                : 'No actions executed yet. Click any button above.'}
            </p>
          ) : (
            statusLog.map((log, index) => <div key={index}>{log}</div>)
          )}
        </div>
      </section>
    </div>
  );
}
