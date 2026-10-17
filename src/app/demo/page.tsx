'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';
import StatusBadge from '@/components/StatusBadge';
import ConflictAlert from '@/components/ConflictAlert';
import { formatNumber, localName } from '@/lib/i18n/translations';
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
    const confirmMsg =
      language === 'bn'
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
        setConcurrentResults(null);
        addLog(
          language === 'bn'
            ? '✅ ডাটাবেস সফলভাবে প্রাথমিক সিড অবস্থায় রিসেট করা হয়েছে।'
            : '✅ Database successfully reset to pristine seed baseline.'
        );
        await fetchParcels();
      } else {
        setResetStatus('error');
        addLog(
          language === 'bn'
            ? `❌ রিসেট ব্যর্থ হয়েছে: ${data.error}`
            : `❌ Reset failed: ${data.error}`
        );
      }
    } catch (err: any) {
      setResetStatus('error');
      addLog(
        language === 'bn'
          ? `❌ রিসেট ত্রুটি: ${err.message}`
          : `❌ Reset error: ${err.message}`
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
      language === 'bn'
        ? '⚡ কনকারেন্সি পরীক্ষা শুরু: P-001 এর জন্য একসাথে ২টি আবেদন পাঠানো হচ্ছে (করিম ও হাসান)...'
        : '⚡ Firing two conflicting transfer requests concurrently for parcel P-001 (Karim vs Hasan)...'
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
      deed_date: '2026-01-15',
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
      deed_date: '2026-01-16',
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
        language === 'bn'
          ? `⚡ ফলাফল: করিম (${karimParsed.transfer_id || 'ত্রুটি'}) -> স্ট্যাটাস "${karimParsed.status || 'ব্যর্থ'}", হাসান (${hasanParsed.transfer_id || 'ত্রুটি'}) -> স্ট্যাটাস "${hasanParsed.status || 'ব্যর্থ'}".`
          : `⚡ Concurrency result: Karim (${karimParsed.transfer_id || 'err'}) -> status "${karimParsed.status || 'failed'}", Hasan (${hasanParsed.transfer_id || 'err'}) -> status "${hasanParsed.status || 'failed'}".`
      );
      await fetchParcels();
    } catch (err: any) {
      setConcurrentState('error');
      addLog(
        language === 'bn'
          ? `❌ কনকারেন্সি পরীক্ষা ব্যর্থ হয়েছে: ${err.message}`
          : `❌ Concurrency test failed: ${err.message}`
      );
    }
  };

  // Demo Step 1: Submit Rahim -> Karim (P-001)
  const runStep1_KarimClean = async () => {
    setSingleStepStatus('step1', 'loading');
    try {
      addLog(
        language === 'bn'
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
          deed_date: '2026-01-15',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step1', 'success');
        addLog(
          language === 'bn'
            ? `✅ ধাপ ১ সফল: আবেদন ${data.transfer_id} তৈরি হয়েছে স্ট্যাটাস "${data.status}" সহ। (সক্রিয় হস্তান্তর প্রতিষ্ঠিত)`
            : `✅ Step 1 Success: Transfer ${data.transfer_id} created with status "${data.status}". (Active transfer established)`
        );
        await fetchParcels();
      } else {
        setSingleStepStatus('step1', 'error');
        addLog(
          language === 'bn'
            ? `❌ ধাপ ১ ত্রুটি: ${data.error}`
            : `❌ Step 1 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step1', 'error');
      addLog(
        language === 'bn'
          ? `❌ ধাপ ১ ত্রুটি: ${err.message}`
          : `❌ Step 1 Error: ${err.message}`
      );
    }
  };

  // Demo Step 2: Submit Rahim -> Hasan (P-001) - Must be held as DOUBLE_SALE
  const runStep2_HasanDoubleSale = async () => {
    setSingleStepStatus('step2', 'loading');
    try {
      addLog(
        language === 'bn'
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
          deed_date: '2026-01-16',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step2', 'success');
        addLog(
          language === 'bn'
            ? `🛑 ধাপ ২ সনাক্ত: আবেদন ${data.transfer_id} দ্বৈত হস্তান্তরের কারণে "${data.status}" অবস্থায় রাখা হয়েছে।`
            : `🛑 Step 2 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with DOUBLE_SALE finding.`
        );
      } else {
        setSingleStepStatus('step2', 'error');
        addLog(
          language === 'bn'
            ? `❌ ধাপ ২ ত্রুটি: ${data.error}`
            : `❌ Step 2 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step2', 'error');
      addLog(
        language === 'bn'
          ? `❌ ধাপ ২ ত্রুটি: ${err.message}`
          : `❌ Step 2 Error: ${err.message}`
      );
    }
  };

  // Demo Step 3: Finalize Karim
  const runStep3_FinalizeKarim = async () => {
    setSingleStepStatus('step3', 'loading');
    try {
      addLog(
        language === 'bn'
          ? 'ধাপ ৩: P-001 এ করিম চৌধুরীর সক্রিয় আবেদন অনুসন্ধান ও চূড়ান্ত নিষ্পত্তি...'
          : 'Step 3: Finding Karim Chowdhury active transfer on P-001 to approve & finalize...'
      );
      const listRes = await fetch('/api/transfers?parcel_id=P-001');
      const listData = await listRes.json();
      const karimTr = listData.transfers?.find((t: any) => t.buyer_name === 'Karim Chowdhury');

      if (!karimTr) {
        setSingleStepStatus('step3', 'error');
        addLog(
          language === 'bn'
            ? '❌ করিম চৌধুরীর আবেদন পাওয়া যায়নি। অনুগ্রহ করে প্রথমে ধাপ ১ সম্পন্ন করুন।'
            : '❌ Karim transfer not found. Please run Step 1 first.'
        );
        return;
      }

      // Transition to under_review -> approved -> finalized
      if (karimTr.status === 'verified') {
        await fetch(`/api/transfers/${karimTr.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'under_review' }),
        });
      }

      await fetch(`/api/transfers/${karimTr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });

      const finRes = await fetch(`/api/transfers/${karimTr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'finalized' }),
      });

      const finData = await finRes.json();
      if (finRes.ok) {
        setSingleStepStatus('step3', 'success');
        addLog(
          language === 'bn'
            ? '🏛️ ধাপ ৩ নিষ্পত্তি সম্পন্ন: করিম চৌধুরী এখন P-001 এর বৈধ নিবন্ধিত মালিক। রেজিস্ট্রি ও মালিকানা ইতিহাস আপডেট হয়েছে।'
            : '🏛️ Step 3 Finalization Complete: Karim is now legal owner of P-001. Registry and ownership history atomically updated.'
        );
        await fetchParcels();
      } else {
        setSingleStepStatus('step3', 'error');
        addLog(
          language === 'bn'
            ? `❌ চূড়ান্ত নিষ্পত্তি ত্রুটি: ${finData.error}`
            : `❌ Finalization Error: ${finData.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step3', 'error');
      addLog(
        language === 'bn'
          ? `❌ চূড়ান্ত নিষ্পত্তি ত্রুটি: ${err.message}`
          : `❌ Finalization Error: ${err.message}`
      );
    }
  };

  // Demo Step 4: Subsequent Rahim Sale (WRONG_SELLER)
  const runStep4_WrongSeller = async () => {
    setSingleStepStatus('step4', 'loading');
    try {
      addLog(
        language === 'bn'
          ? 'ধাপ ৪: P-001 এ রহিম কর্তৃক নতুন আবেদন দাখিল (করিম এখন মালিক হওয়ায় এটি অননুমোদিত বিক্রেতা)...'
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
          deed_date: '2026-01-20',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step4', 'success');
        addLog(
          language === 'bn'
            ? `🛑 ধাপ ৪ সনাক্ত: আবেদন ${data.transfer_id} অননুমোদিত বিক্রেতা সনাক্ত হওয়ায় "${data.status}" অবস্থায় রাখা হয়েছে!`
            : `🛑 Step 4 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with WRONG_SELLER finding!`
        );
      } else {
        setSingleStepStatus('step4', 'error');
        addLog(
          language === 'bn'
            ? `❌ ধাপ ৪ ত্রুটি: ${data.error}`
            : `❌ Step 4 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step4', 'error');
      addLog(
        language === 'bn'
          ? `❌ ধাপ ৪ ত্রুটি: ${err.message}`
          : `❌ Step 4 Error: ${err.message}`
      );
    }
  };

  // Demo Step 5: P-002 Record Mismatch Demo
  const runStep5_RecordMismatch = async () => {
    setSingleStepStatus('step5', 'loading');
    try {
      addLog(
        language === 'bn'
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
          deed_date: '2026-01-18',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSingleStepStatus('step5', 'success');
        addLog(
          language === 'bn'
            ? `🛑 ধাপ ৫ সনাক্ত: আবেদন ${data.transfer_id} তথ্যের অমিলে "${data.status}" অবস্থায় রাখা হয়েছে!`
            : `🛑 Step 5 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with RECORD_MISMATCH detailing all differing fields!`
        );
      } else {
        setSingleStepStatus('step5', 'error');
        addLog(
          language === 'bn'
            ? `❌ ধাপ ৫ ত্রুটি: ${data.error}`
            : `❌ Step 5 Error: ${data.error}`
        );
      }
    } catch (err: any) {
      setSingleStepStatus('step5', 'error');
      addLog(
        language === 'bn'
          ? `❌ ধাপ ৫ ত্রুটি: ${err.message}`
          : `❌ Step 5 Error: ${err.message}`
      );
    }
  };

  // Helper for accessible button content (icon + text, never color alone)
  const renderButtonContent = (
    stepKey: string,
    idleText: string,
    idleIcon: string = '▶'
  ) => {
    const s = stepStatus[stepKey] || 'idle';
    if (s === 'loading') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="animate-spin">⏳</span>
          <span>{language === 'bn' ? 'চলছে...' : 'Running...'}</span>
        </span>
      );
    }
    if (s === 'success') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span>✅</span>
          <span>{language === 'bn' ? 'সম্পন্ন' : 'Done'}</span>
        </span>
      );
    }
    if (s === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span>❌</span>
          <span>{language === 'bn' ? 'ব্যর্থ' : 'Failed'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{idleIcon}</span>
        <span>{idleText}</span>
      </span>
    );
  };

  const isAnyStepRunning =
    Object.values(stepStatus).some((s) => s === 'loading') ||
    concurrentState === 'loading' ||
    resetting;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner and Reset Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            🎮 {t('demo_title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('demo_subtitle')}
          </p>
        </div>

        <button
          onClick={handleResetDemoData}
          disabled={isAnyStepRunning}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition disabled:opacity-50"
          aria-label={t('demo_reset_btn')}
        >
          {resetStatus === 'loading' ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>{t('demo_resetting')}</span>
            </>
          ) : resetStatus === 'success' ? (
            <>
              <span>✅</span>
              <span>{language === 'bn' ? 'রিসেট সম্পন্ন' : 'Reset Complete'}</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>{t('demo_reset_btn')}</span>
            </>
          )}
        </button>
      </div>

      {/* Concurrent Conflict Test (Race Condition Simulation) */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 text-white border-2 border-emerald-500/40 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {language === 'bn'
                  ? 'কনকারেন্সি পরীক্ষা: একসাথে দুটি সংঘাতপূর্ণ অনুরোধ'
                  : 'Concurrency Race Test: Simultaneous Conflicting Submissions'}
              </h3>
              <p className="text-xs text-slate-400">
                {language === 'bn'
                  ? 'Promise.all ব্যবহার করে P-001 এর জন্য একসাথে দুটি আবেদন পাঠিয়ে ইউনিক ইনডেক্স ও বিরোধ সনাক্তকরণ পরীক্ষা'
                  : 'Fires two conflicting requests simultaneously via Promise.all to test physical locking and DOUBLE_SALE detection'}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700 w-fit">
            P-001 ({formatNumber(5.0, language)} {language === 'bn' ? 'শতক' : 'Decimal'})
          </span>
        </div>

        {/* Hint Banner */}
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-start gap-2.5">
          <span className="text-base">💡</span>
          <div>
            <span className="font-bold text-emerald-400">
              {language === 'bn' ? 'পরামর্শ:' : 'Evaluation Hint:'}{' '}
            </span>
            <span>{t('demo_concurrent_hint')}</span>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={runConcurrentConflictTest}
            disabled={isAnyStepRunning}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2"
          >
            {concurrentState === 'loading' ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>
                  {language === 'bn'
                    ? 'একসাথে দুটি অনুরোধ পাঠানো হচ্ছে...'
                    : 'Firing concurrent requests...'}
                </span>
              </>
            ) : concurrentState === 'success' ? (
              <>
                <span>✅</span>
                <span>
                  {language === 'bn'
                    ? 'উভয় অনুরোধ সম্পন্ন ও বিশ্লেষণ করা হয়েছে'
                    : 'Both requests processed & analyzed'}
                </span>
              </>
            ) : concurrentState === 'error' ? (
              <>
                <span>❌</span>
                <span>
                  {language === 'bn'
                    ? 'অনুরোধ ব্যর্থ হয়েছে'
                    : 'Execution failed'}
                </span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>{t('demo_concurrent_btn')}</span>
              </>
            )}
          </button>
        </div>

        {/* Side-by-Side Results Comparison */}
        {concurrentResults && (
          <div className="space-y-3 pt-3 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span>📊</span>
              <span>
                {language === 'bn'
                  ? 'পাশাপাশি ফলাফল তুলনা (একই সময়ে দাখিলকৃত)'
                  : 'Side-by-Side Result Comparison (Simultaneously Dispatched)'}
              </span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Karim Chowdhury */}
              <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📄</span>
                    <div>
                      <h5 className="font-bold text-xs text-white">
                        {language === 'bn' ? 'অনুরোধ ১: করিম চৌধুরী' : 'Request 1: Karim Chowdhury'}
                      </h5>
                      <span className="text-[11px] font-mono text-slate-400">
                        {concurrentResults.karim?.deed_number} • NID-DEMO-0002
                      </span>
                    </div>
                  </div>
                  {concurrentResults.karim?.status && (
                    <StatusBadge status={concurrentResults.karim.status} size="sm" />
                  )}
                </div>

                {concurrentResults.karim?.transfer_id && (
                  <div className="text-xs font-mono text-emerald-400">
                    ID: {concurrentResults.karim.transfer_id}
                  </div>
                )}

                {concurrentResults.karim?.error ? (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <span>❌</span>
                    <span>{concurrentResults.karim.error}</span>
                  </div>
                ) : concurrentResults.karim?.status === 'verified' ? (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-medium space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>✓</span>
                      <span>
                        {language === 'bn'
                          ? 'সক্রিয় যাচাইকৃত আবেদন হিসেবে গৃহীত'
                          : 'Accepted as Active Verified Transfer'}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-400/80">
                      {language === 'bn'
                        ? 'এটি প্রথমে ডেটাবেসে প্রবেশ করেছে এবং সক্রিয় স্ট্যাটাস অর্জন করেছে।'
                        : 'Resolved lock first and established the active transfer for parcel P-001.'}
                    </p>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-medium space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>🛑</span>
                      <span>
                        {language === 'bn'
                          ? 'আবেদনটি স্থগিত (Held) করা হয়েছে'
                          : 'Transfer Placed on Hold'}
                      </span>
                    </div>
                    {concurrentResults.karim?.findings && (
                      <div className="pt-2 text-slate-900">
                        <ConflictAlert findings={concurrentResults.karim.findings} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 2: Hasan Mahmud */}
              <div className="p-4 rounded-xl bg-slate-800/90 border border-slate-700 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📄</span>
                    <div>
                      <h5 className="font-bold text-xs text-white">
                        {language === 'bn' ? 'অনুরোধ ২: হাসান মাহমুদ' : 'Request 2: Hasan Mahmud'}
                      </h5>
                      <span className="text-[11px] font-mono text-slate-400">
                        {concurrentResults.hasan?.deed_number} • NID-DEMO-0003
                      </span>
                    </div>
                  </div>
                  {concurrentResults.hasan?.status && (
                    <StatusBadge status={concurrentResults.hasan.status} size="sm" />
                  )}
                </div>

                {concurrentResults.hasan?.transfer_id && (
                  <div className="text-xs font-mono text-amber-400">
                    ID: {concurrentResults.hasan.transfer_id}
                  </div>
                )}

                {concurrentResults.hasan?.error ? (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <span>❌</span>
                    <span>{concurrentResults.hasan.error}</span>
                  </div>
                ) : concurrentResults.hasan?.status === 'held' ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-300 text-xs font-medium space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>🛑</span>
                        <span>
                          {language === 'bn'
                            ? 'দ্বৈত হস্তান্তরের কারণে স্থগিত (Held)'
                            : 'Held Automatically via DOUBLE_SALE Detection'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-400/80">
                        {language === 'bn'
                          ? 'একই প্লটে পূর্বে সক্রিয় আবেদন থাকায় স্বয়ংক্রিয়ভাবে স্থগিত করা হয়েছে।'
                          : 'PostgreSQL unique constraint & DOUBLE_SALE rule caught the conflicting claim.'}
                      </p>
                    </div>

                    {concurrentResults.hasan?.findings && (
                      <div className="text-slate-900 dark:text-white">
                        <ConflictAlert findings={concurrentResults.hasan.findings} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-medium">
                    <span className="font-bold">
                      {language === 'bn' ? '✓ যাচাইকৃত' : '✓ Verified'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guided Presentation Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scenario 1: P-001 Lifecycle */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {language === 'bn'
                ? 'পরিস্থিতি ১: পার্সেল P-001 সংঘাত জীবনচক্র'
                : 'Scenario 1: Parcel P-001 Conflict Lifecycle'}
            </h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              P-001 ({formatNumber(5.0, language)} {language === 'bn' ? 'শতক' : 'Decimal'})
            </span>
          </div>

          <div className="space-y-3">
            {/* Step 1 */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? '১. রহিম → করিম (সঠিক হস্তান্তর)'
                    : '1. Rahim → Karim (Clean Transfer)'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'প্রাথমিক দাখিল সমস্ত যাচাইকরণ উত্তীর্ণ হয়ে "যাচাইকৃত" সক্রিয় অবস্থায় প্রবেশ করে।'
                    : 'Initial submission passes all checks and enters "verified" active state.'}
                </p>
              </div>
              <button
                onClick={runStep1_KarimClean}
                disabled={isAnyStepRunning}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 shrink-0"
              >
                {renderButtonContent('step1', language === 'bn' ? 'চালান' : 'Execute')}
              </button>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? '২. রহিম → হাসান (দ্বৈত হস্তান্তর)'
                    : '2. Rahim → Hasan (Double Sale)'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'P-001 এ সক্রিয় আবেদন থাকায় স্বয়ংক্রিয়ভাবে স্থগিত (held) করা হয়।'
                    : 'Detected and held automatically due to existing active transfer on P-001.'}
                </p>
              </div>
              <button
                onClick={runStep2_HasanDoubleSale}
                disabled={isAnyStepRunning}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 shrink-0"
              >
                {renderButtonContent('step2', language === 'bn' ? 'চালান' : 'Execute')}
              </button>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? '৩. করিম চৌধুরীর চূড়ান্ত নিষ্পত্তি'
                    : '3. Finalize Karim Chowdhury'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'অনুমোদন ও চূড়ান্ত নিষ্পত্তি। মালিকানা করিমে পরিবর্তিত হয় এবং অডিট ব্লক রেকর্ড করে।'
                    : 'Approve and finalize. Updates legal owner to Karim and records audit block.'}
                </p>
              </div>
              <button
                onClick={runStep3_FinalizeKarim}
                disabled={isAnyStepRunning}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50 shrink-0"
              >
                {renderButtonContent(
                  'step3',
                  language === 'bn' ? 'চূড়ান্ত নিষ্পত্তি' : 'Finalize',
                  '🏛️'
                )}
              </button>
            </div>

            {/* Step 4 */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? '৪. রহিমের পরবর্তী বিক্রয় (অননুমোদিত বিক্রেতা)'
                    : '4. Subsequent Rahim Sale (Wrong Seller)'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'ব্যর্থ হয় কারণ রহিম আর P-001 এর বৈধ নিবন্ধিত মালিক নন।'
                    : 'Fails because Rahim is no longer recorded owner of P-001.'}
                </p>
              </div>
              <button
                onClick={runStep4_WrongSeller}
                disabled={isAnyStepRunning}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition disabled:opacity-50 shrink-0"
              >
                {renderButtonContent('step4', language === 'bn' ? 'চালান' : 'Execute')}
              </button>
            </div>
          </div>
        </div>

        {/* Scenario 2 & 3: P-002 Mismatch & Integrity */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              {language === 'bn'
                ? 'পরিস্থিতি ২ ও ৩: তথ্যের অমিল ও অডিট টেম্পারিং'
                : 'Scenario 2 & 3: Discrepancies & Tampering'}
            </h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              {language === 'bn' ? 'P-002 ও অডিট লেজার' : 'P-002 & Audit Ledger'}
            </span>
          </div>

          <div className="space-y-3">
            {/* Step 5 */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? '৫. P-002 রেকর্ডের অমিল ডেমো'
                    : '5. Record Mismatch Demo on P-002'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'ভুল দাগ ও পরিমাণের আবেদন দাখিল। সকল অসঙ্গতি স্পষ্টভাবে প্রদর্শন করে।'
                    : 'Submits mismatched Dag & Area. Reports all differing fields cleanly.'}
                </p>
              </div>
              <button
                onClick={runStep5_RecordMismatch}
                disabled={isAnyStepRunning}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition disabled:opacity-50 shrink-0"
              >
                {renderButtonContent('step5', language === 'bn' ? 'চালান' : 'Execute')}
              </button>
            </div>

            {/* Step 6 */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? '৬. অডিট চেইনের অখণ্ডতা নিরীক্ষক'
                    : '6. Audit Chain Integrity Checker'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'ক্রিপ্টোগ্রাফিক লেজার ব্লক পরীক্ষা, Ed25519 ডিজিটাল স্বাক্ষর যাচাই অথবা টেম্পারিং টেস্ট।'
                    : 'Inspect cryptographic ledger blocks, verify Ed25519 signatures, or inject tampering.'}
                </p>
              </div>
              <button
                onClick={() => router.push('/integrity')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition shrink-0 inline-flex items-center gap-1.5"
              >
                <span>🔍</span>
                <span>{language === 'bn' ? 'নিরীক্ষক খুলুন →' : 'Open Auditor →'}</span>
              </button>
            </div>

            {/* Step 7 */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  {language === 'bn'
                    ? '৭. পর্যালোচনা কিউ ও আবেদন তালিকা'
                    : '7. Review Queue & Applications Table'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {language === 'bn'
                    ? 'স্ট্যাটাস ফিল্টার ও সক্রিয় ওয়ার্কফ্লো অ্যাকশনসহ বর্তমান কিউ দেখুন।'
                    : 'View current review queue with status filters and active workflow actions.'}
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition shrink-0 inline-flex items-center gap-1.5"
              >
                <span>📋</span>
                <span>{language === 'bn' ? 'কিউ খুলুন →' : 'Open Queue →'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Realtime Execution Log Console */}
      <div className="p-6 rounded-2xl bg-slate-950 text-slate-200 border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-400 flex items-center gap-2">
            <span>💻</span>
            <span>
              {language === 'bn' ? 'এক্সিকিউশন লগ কনসোল' : 'Execution Log Console'}
            </span>
          </span>
          <button
            onClick={() => setStatusLog([])}
            className="text-[10px] text-slate-500 hover:text-slate-300 inline-flex items-center gap-1"
          >
            <span>🗑️</span>
            <span>{language === 'bn' ? 'লগ মুছুন' : 'Clear Log'}</span>
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1">
          {statusLog.length === 0 ? (
            <p className="text-slate-600 italic">
              {language === 'bn'
                ? 'এখনো কোনো পদক্ষেপ চালানো হয়নি। উপরের যেকোনো বোতামে ক্লিক করুন।'
                : 'No actions executed yet. Click any button above.'}
            </p>
          ) : (
            statusLog.map((log, index) => <div key={index}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
