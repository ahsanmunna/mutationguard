'use client';

import React from 'react';
import { Check, Clock, Landmark } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { formatDate, localName, Language } from '@/lib/i18n/translations';
import { TimelineEvent } from '@/lib/transfer-view';

export interface ParcelTimelineProps {
  events: TimelineEvent[];
  currentOwnerName?: string;
  language?: Language;
  unavailable?: boolean;
}

export function ParcelTimeline({
  events,
  currentOwnerName,
  language: propLanguage,
  unavailable = false,
}: ParcelTimelineProps) {
  const context = useLanguage();
  const language = propLanguage || context?.language || 'bn';
  const bn = language === 'bn';

  if (unavailable) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {bn ? 'মালিকানার ইতিহাস অনুপলব্ধ' : 'Ownership history unavailable'}
        </p>
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="text-slate-500 font-normal">
            {bn ? 'বর্তমান নথিভুক্ত মালিক: ' : 'Current recorded owner: '}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {currentOwnerName ? localName(currentOwnerName, language) : '—'}
          </span>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {bn ? 'কোনো মালিকানা ইতিহাস নেই' : 'No ownership history available'}
        </p>
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="text-slate-500 font-normal">
            {bn ? 'বর্তমান নথিভুক্ত মালিক: ' : 'Current recorded owner: '}
          </span>
          <span className="font-medium text-slate-900 dark:text-white">
            {currentOwnerName ? localName(currentOwnerName, language) : '—'}
          </span>
        </div>
      </div>
    );
  }

  const getApplicationText = (status?: string) => {
    if (status === 'held') {
      return bn
        ? 'পর্যালোচনার জন্য স্থগিত (মালিকানা পরিবর্তন নয়)'
        : 'Held for review (not an ownership change)';
    }
    if (status === 'rejected') {
      return bn
        ? 'বাতিলকৃত (মালিকানা পরিবর্তন নয়)'
        : 'Rejected (not an ownership change)';
    }
    return bn
      ? 'প্রক্রিয়াধীন আবেদন (মালিকানা পরিবর্তন নয়)'
      : 'Pending application (not an ownership change)';
  };

  return (
    <div className="space-y-5">
      <ol
        aria-label={bn ? 'মালিকানার ইতিহাস টাইমলাইন' : 'Ownership history timeline'}
        className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3.5 pl-6 space-y-6 text-xs"
      >
        {events.map((event, i) => (
          <li key={`${event.kind}-${i}-${event.reference}`} className="relative space-y-1.5">
            {/* Marker */}
            {event.kind === 'baseline' ? (
              <span
                className="absolute -left-[36px] top-0.5 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 flex items-center justify-center ring-4 ring-white dark:ring-slate-900"
                aria-hidden="true"
              >
                <Landmark className="w-3.5 h-3.5" strokeWidth={1.75} />
              </span>
            ) : event.kind === 'ownership_change' ? (
              <span
                className="absolute -left-[36px] top-0.5 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-4 ring-white dark:ring-slate-900"
                aria-hidden="true"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2} />
              </span>
            ) : (
              <span
                className={`absolute -left-[36px] top-0.5 w-6 h-6 rounded-full border-2 border-dashed flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${
                  event.status === 'rejected'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                    : 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                }`}
                aria-hidden="true"
              >
                <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
              </span>
            )}

            {/* Event Description */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">
                {event.kind === 'baseline'
                  ? `${bn ? 'নথিভুক্ত মালিক' : 'Recorded owner'}: ${localName(event.ownerTo, language)}`
                  : event.kind === 'ownership_change'
                  ? bn
                    ? `মালিকানা হস্তান্তর: ${localName(event.ownerFrom, language)} থেকে ${localName(event.ownerTo, language)}`
                    : `Ownership transferred: ${localName(event.ownerFrom, language)} to ${localName(event.ownerTo, language)}`
                  : getApplicationText(event.status)}
              </span>

              {event.isThisTransfer && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                  {bn ? 'এই আবেদন' : 'This application'}
                </span>
              )}
            </div>

            {/* Reference and Date Details */}
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex flex-wrap items-center gap-2">
              <span>{event.reference}</span>
              <span>•</span>
              <span>
                {formatDate(
                  event.date instanceof Date
                    ? event.date.toISOString()
                    : String(event.date || ''),
                  language
                )}
              </span>
              {event.kind === 'application' && (event.ownerFrom || event.ownerTo) && (
                <>
                  <span>•</span>
                  <span className="font-sans">
                    {localName(event.ownerFrom, language)} → {localName(event.ownerTo, language)}
                  </span>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Current Recorded Owner */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
        <span className="text-slate-500 font-normal">
          {bn ? 'বর্তমান নথিভুক্ত মালিক: ' : 'Current recorded owner: '}
        </span>
        <span className="font-medium text-slate-900 dark:text-white">
          {currentOwnerName ? localName(currentOwnerName, language) : '—'}
        </span>
      </div>
    </div>
  );
}

export default ParcelTimeline;
