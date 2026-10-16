'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageContext';

export default function DemoPage() {
  const router = useRouter();
  const { t, language } = useLanguage();

  const [resetting, setResetting] = useState(false);
  const [runningStep, setRunningStep] = useState<string | null>(null);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);

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

  const handleResetDemoData = async () => {
    if (!confirm('Are you sure you want to reset all test data back to the clean seed state?')) {
      return;
    }

    try {
      setResetting(true);
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        addLog('✅ Database successfully reset to pristine seed baseline.');
        await fetchParcels();
      } else {
        addLog(`❌ Reset failed: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Reset error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  // Demo Step 1: Submit Rahim -> Karim (P-001)
  const runStep1_KarimClean = async () => {
    setRunningStep('step1');
    try {
      addLog('Step 1: Submitting clean transfer for P-001 (Rahim Uddin → Karim Chowdhury)...');
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`✅ Step 1 Success: Transfer ${data.transfer_id} created with status "${data.status}". (Active transfer established)`);
      } else {
        addLog(`❌ Step 1 Error: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Step 1 Error: ${err.message}`);
    } finally {
      setRunningStep(null);
    }
  };

  // Demo Step 2: Submit Rahim -> Hasan (P-001) - Must be held as DOUBLE_SALE
  const runStep2_HasanDoubleSale = async () => {
    setRunningStep('step2');
    try {
      addLog('Step 2: Submitting conflicting transfer for P-001 (Rahim Uddin → Hasan Mahmud)...');
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`🛑 Step 2 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with DOUBLE_SALE finding.`);
      } else {
        addLog(`❌ Step 2 Error: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Step 2 Error: ${err.message}`);
    } finally {
      setRunningStep(null);
    }
  };

  // Demo Step 3: Finalize Karim
  const runStep3_FinalizeKarim = async () => {
    setRunningStep('step3');
    try {
      addLog('Step 3: Finding Karim Chowdhury active transfer on P-001 to approve & finalize...');
      const listRes = await fetch('/api/transfers?parcel_id=P-001');
      const listData = await listRes.json();
      const karimTr = listData.transfers?.find((t: any) => t.buyer_name === 'Karim Chowdhury');

      if (!karimTr) {
        addLog('❌ Karim transfer not found. Please run Step 1 first.');
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
        addLog(`🏛️ Step 3 Finalization Complete: Karim is now legal owner of P-001. Registry and ownership history atomically updated.`);
        await fetchParcels();
      } else {
        addLog(`❌ Finalization Error: ${finData.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Finalization Error: ${err.message}`);
    } finally {
      setRunningStep(null);
    }
  };

  // Demo Step 4: Subsequent Rahim Sale (WRONG_SELLER)
  const runStep4_WrongSeller = async () => {
    setRunningStep('step4');
    try {
      addLog('Step 4: Submitting subsequent sale on P-001 with Rahim as seller (Now invalid since Karim is owner)...');
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcel_id: 'P-001',
          deed_number: 'DEED-2026-004',
          seller_name: 'Rahim Uddin',
          seller_nid: '1985000000001',
          buyer_name: 'Zubair Hossain',
          buyer_nid: '1997000000010',
          application_mouza: 'Dhanmondi-102',
          application_khatian: 'K-501',
          application_dag: 'D-1001',
          application_area_decimal: '5.00',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`🛑 Step 4 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with WRONG_SELLER finding!`);
      } else {
        addLog(`❌ Step 4 Error: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Step 4 Error: ${err.message}`);
    } finally {
      setRunningStep(null);
    }
  };

  // Demo Step 5: P-002 Record Mismatch Demo
  const runStep5_RecordMismatch = async () => {
    setRunningStep('step5');
    try {
      addLog('Step 5: Submitting P-002 mutation with deliberate Dag & Area discrepancies...');
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcel_id: 'P-002',
          deed_number: 'DEED-2026-003',
          seller_name: 'Abdul Maleque',
          seller_nid: '1978000000004',
          buyer_name: 'Rafiqul Alam',
          buyer_nid: '1995000000009',
          application_mouza: 'Gulshan-103',
          application_khatian: 'K-602',
          application_dag: 'D-2099', // Discrepancy
          application_area_decimal: '8.00', // Discrepancy
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addLog(`🛑 Step 5 Triggered: Transfer ${data.transfer_id} placed on "${data.status}" with RECORD_MISMATCH detailing all differing fields!`);
      } else {
        addLog(`❌ Step 5 Error: ${data.error}`);
      }
    } catch (err: any) {
      addLog(`❌ Step 5 Error: ${err.message}`);
    } finally {
      setRunningStep(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            🎮 Student Demo & Presentation Control Panel
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gated review console for rehearsing the required evaluation scenarios without manual database edits.
          </p>
        </div>

        <button
          onClick={handleResetDemoData}
          disabled={resetting}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow transition disabled:opacity-50"
        >
          {resetting ? 'Resetting...' : '🔄 Reset All Data to Clean Seed'}
        </button>
      </div>

      {/* Guided Presentation Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scenario 1: P-001 Lifecycle */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Scenario 1: Parcel P-001 Conflict Lifecycle
            </h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              P-001 (5.00 Decimal)
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  1. Rahim → Karim (Clean Transfer)
                </p>
                <p className="text-[11px] text-slate-500">
                  Initial submission passes all checks and enters &quot;verified&quot; active state.
                </p>
              </div>
              <button
                onClick={runStep1_KarimClean}
                disabled={runningStep !== null}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Execute
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  2. Rahim → Hasan (Double Sale)
                </p>
                <p className="text-[11px] text-slate-500">
                  Detected and held automatically due to existing active transfer on P-001.
                </p>
              </div>
              <button
                onClick={runStep2_HasanDoubleSale}
                disabled={runningStep !== null}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Execute
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  3. Finalize Karim Chowdhury
                </p>
                <p className="text-[11px] text-slate-500">
                  Approve and finalize. Updates legal owner to Karim and records audit block.
                </p>
              </div>
              <button
                onClick={runStep3_FinalizeKarim}
                disabled={runningStep !== null}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Finalize
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  4. Subsequent Rahim Sale (Wrong Seller)
                </p>
                <p className="text-[11px] text-slate-500">
                  Fails because Rahim is no longer recorded owner of P-001.
                </p>
              </div>
              <button
                onClick={runStep4_WrongSeller}
                disabled={runningStep !== null}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Execute
              </button>
            </div>
          </div>
        </div>

        {/* Scenario 2 & 3: P-002 Mismatch & Integrity */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Scenario 2 & 3: Discrepancies & Tampering
            </h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              P-002 & Audit Ledger
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  5. Record Mismatch Demo on P-002
                </p>
                <p className="text-[11px] text-slate-500">
                  Submits mismatched Dag & Area. Reports all differing fields cleanly.
                </p>
              </div>
              <button
                onClick={runStep5_RecordMismatch}
                disabled={runningStep !== null}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Execute
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  6. Audit Chain Integrity Checker
                </p>
                <p className="text-[11px] text-slate-500">
                  Inspect cryptographic ledger blocks, verify Ed25519 signatures, or inject tampering.
                </p>
              </div>
              <button
                onClick={() => router.push('/integrity')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold transition"
              >
                Open Auditor →
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
              <div>
                <p className="font-semibold text-xs text-slate-900 dark:text-white">
                  7. Review Queue & Applications Table
                </p>
                <p className="text-[11px] text-slate-500">
                  View current review queue with status filters and active workflow actions.
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold transition"
              >
                Open Queue →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Realtime Execution Log Console */}
      <div className="p-6 rounded-2xl bg-slate-950 text-slate-200 border border-slate-800 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-slate-400">Execution Log Console</span>
          <button
            onClick={() => setStatusLog([])}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            Clear Log
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1">
          {statusLog.length === 0 ? (
            <p className="text-slate-600 italic">No actions executed yet. Click any button above.</p>
          ) : (
            statusLog.map((log, index) => <div key={index}>{log}</div>)
          )}
        </div>
      </div>
    </div>
  );
}
