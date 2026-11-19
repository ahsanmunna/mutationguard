/**
 * Pure evaluation functions for guided demo scenarios and concurrency tests.
 * Validates whether API responses match the expected security invariant outcomes.
 */

export type DemoStepId =
  | 'step1'
  | 'step2'
  | 'step3'
  | 'step4'
  | 'step5'
  | 'race'
  | 1
  | 2
  | 3
  | 4
  | 5;

export interface StepEvaluation {
  ok: boolean;
  message: string;
}

/**
 * Evaluates the actual response of a demo step against its expected outcome.
 * Pure function: does not perform network, I/O, or state mutations.
 *
 * Expected outcomes:
 * - step 1: status 'verified' with no findings
 * - step 2: status 'held' with a DOUBLE_SALE finding
 * - step 3: finalize chain succeeded and parcel owner is now Karim Chowdhury
 * - step 4: status 'held' with a WRONG_SELLER finding
 * - step 5: status 'held' with a RECORD_MISMATCH finding
 * - race: exactly one 'verified' and one 'held' with a DOUBLE_SALE finding
 */
export function evaluateStepOutcome(
  step: DemoStepId,
  response: any,
  lang: 'bn' | 'en' = 'en'
): StepEvaluation {
  const isBn = lang === 'bn';
  const normalizedStep = typeof step === 'number' ? `step${step}` : step;

  if (!response || typeof response !== 'object') {
    return {
      ok: false,
      message: isBn
        ? 'কোনো বৈধ প্রতিক্রিয়া পাওয়া যায়নি।'
        : 'No valid response received.',
    };
  }

  if (response.error && normalizedStep !== 'race' && normalizedStep !== 'step3') {
    return {
      ok: false,
      message: isBn
        ? `অনুরোধ ব্যর্থ হয়েছে: ${response.error}`
        : `Request failed: ${response.error}`,
    };
  }

  switch (normalizedStep) {
    case 'step1': {
      // Expected: status 'verified' with no findings
      if (response.status !== 'verified') {
        return {
          ok: false,
          message: isBn
            ? `প্রত্যাশিত স্ট্যাটাস "verified", কিন্তু পাওয়া গেছে "${response.status || 'unknown'}"।`
            : `Expected status "verified", but got "${response.status || 'unknown'}".`,
        };
      }
      const findings = Array.isArray(response.findings) ? response.findings : [];
      if (findings.length > 0) {
        const rules = findings.map((f: any) => f?.rule_id || 'unknown').join(', ');
        return {
          ok: false,
          message: isBn
            ? `কোনো অসঙ্গতি ছাড়া যাচাই প্রত্যাশিত, কিন্তু পাওয়া গেছে: ${rules}।`
            : `Expected no findings, but got: ${rules}.`,
        };
      }
      return {
        ok: true,
        message: isBn
          ? 'আবেদনটি কোনো অসঙ্গতি ছাড়াই যাচাইকৃত (verified) হয়েছে।'
          : 'Transfer verified cleanly with 0 findings.',
      };
    }

    case 'step2': {
      // Expected: status 'held' with a DOUBLE_SALE finding
      if (response.status !== 'held') {
        return {
          ok: false,
          message: isBn
            ? `প্রত্যাশিত স্ট্যাটাস "held", কিন্তু পাওয়া গেছে "${response.status || 'unknown'}"।`
            : `Expected status "held", but got "${response.status || 'unknown'}".`,
        };
      }
      const findings = Array.isArray(response.findings) ? response.findings : [];
      const hasDoubleSale = findings.some((f: any) => f?.rule_id === 'DOUBLE_SALE');
      if (!hasDoubleSale) {
        const rules = findings.map((f: any) => f?.rule_id || 'unknown').join(', ') || 'none';
        return {
          ok: false,
          message: isBn
            ? `DOUBLE_SALE অসঙ্গতি প্রত্যাশিত, কিন্তু পাওয়া গেছে: ${rules}।`
            : `Expected DOUBLE_SALE finding, but got: ${rules}.`,
        };
      }
      return {
        ok: true,
        message: isBn
          ? 'বিদ্যমান সক্রিয় হস্তান্তরের কারণে আবেদনটি DOUBLE_SALE সহ স্থগিত (held) হয়েছে।'
          : 'Transfer held with DOUBLE_SALE finding as expected.',
      };
    }

    case 'step3': {
      // Expected: finalize chain succeeded and parcel owner is now Karim Chowdhury
      const success = response.success === true || response.ok === true || response.status === 'finalized';
      if (!success) {
        return {
          ok: false,
          message: isBn
            ? `চূড়ান্ত নিষ্পত্তি চেইন ব্যর্থ হয়েছে: ${response.error || 'অজানা ত্রুটি'}।`
            : `Finalize chain failed: ${response.error || 'unsuccessful transition'}.`,
        };
      }
      const owner =
        response.new_owner ||
        response.current_owner_name ||
        response.parcel?.current_owner_name ||
        response.owner;

      if (owner !== 'Karim Chowdhury') {
        return {
          ok: false,
          message: isBn
            ? `পার্সেলের বর্তমান মালিক "Karim Chowdhury" প্রত্যাশিত, কিন্তু পাওয়া গেছে "${owner || 'unknown'}"।`
            : `Expected parcel owner to be Karim Chowdhury, but got "${owner || 'unknown'}".`,
        };
      }
      return {
        ok: true,
        message: isBn
          ? 'চূড়ান্ত নিষ্পত্তি সফল হয়েছে এবং পার্সেল মালিক এখন করিম চৌধুরী।'
          : 'Finalize chain succeeded; parcel owner is now Karim Chowdhury.',
      };
    }

    case 'step4': {
      // Expected: status 'held' with a WRONG_SELLER finding
      if (response.status !== 'held') {
        return {
          ok: false,
          message: isBn
            ? `প্রত্যাশিত স্ট্যাটাস "held", কিন্তু পাওয়া গেছে "${response.status || 'unknown'}"।`
            : `Expected status "held", but got "${response.status || 'unknown'}".`,
        };
      }
      const findings = Array.isArray(response.findings) ? response.findings : [];
      const hasWrongSeller = findings.some((f: any) => f?.rule_id === 'WRONG_SELLER');
      if (!hasWrongSeller) {
        const rules = findings.map((f: any) => f?.rule_id || 'unknown').join(', ') || 'none';
        return {
          ok: false,
          message: isBn
            ? `WRONG_SELLER অসঙ্গতি প্রত্যাশিত, কিন্তু পাওয়া গেছে: ${rules}।`
            : `Expected WRONG_SELLER finding, but got: ${rules}.`,
        };
      }
      return {
        ok: true,
        message: isBn
          ? 'রহিম আর মালিক না থাকায় আবেদনটি WRONG_SELLER সহ স্থগিত (held) হয়েছে।'
          : 'Transfer held with WRONG_SELLER finding as expected.',
      };
    }

    case 'step5': {
      // Expected: status 'held' with a RECORD_MISMATCH finding
      if (response.status !== 'held') {
        return {
          ok: false,
          message: isBn
            ? `প্রত্যাশিত স্ট্যাটাস "held", কিন্তু পাওয়া গেছে "${response.status || 'unknown'}"।`
            : `Expected status "held", but got "${response.status || 'unknown'}".`,
        };
      }
      const findings = Array.isArray(response.findings) ? response.findings : [];
      const hasRecordMismatch = findings.some((f: any) => f?.rule_id === 'RECORD_MISMATCH');
      if (!hasRecordMismatch) {
        const rules = findings.map((f: any) => f?.rule_id || 'unknown').join(', ') || 'none';
        return {
          ok: false,
          message: isBn
            ? `RECORD_MISMATCH অসঙ্গতি প্রত্যাশিত, কিন্তু পাওয়া গেছে: ${rules}।`
            : `Expected RECORD_MISMATCH finding, but got: ${rules}.`,
        };
      }
      return {
        ok: true,
        message: isBn
          ? 'দাগ ও পরিমাণের অসঙ্গতির কারণে আবেদনটি RECORD_MISMATCH সহ স্থগিত (held) হয়েছে।'
          : 'Transfer held with RECORD_MISMATCH finding as expected.',
      };
    }

    case 'race': {
      // Expected: race exactly one 'verified' and one 'held' with a DOUBLE_SALE finding
      let items: any[] = [];
      if (Array.isArray(response)) {
        items = response;
      } else if (Array.isArray(response.results)) {
        items = response.results;
      } else if (response && typeof response === 'object') {
        if ('karim' in response || 'hasan' in response) {
          items = [response.karim, response.hasan].filter(Boolean);
        } else if ('req1' in response || 'req2' in response) {
          items = [response.req1, response.req2].filter(Boolean);
        } else {
          items = Object.values(response).filter((v) => typeof v === 'object' && v !== null);
        }
      }

      if (items.length !== 2) {
        return {
          ok: false,
          message: isBn
            ? `ঠিক ২টি কনকারেন্ট ফলাফল প্রত্যাশিত, কিন্তু পাওয়া গেছে ${items.length}টি।`
            : `Expected exactly two concurrent results, but got ${items.length}.`,
        };
      }

      const verifiedCount = items.filter((item) => item?.status === 'verified').length;
      const heldItems = items.filter((item) => item?.status === 'held');
      const heldCount = heldItems.length;

      if (verifiedCount === 2) {
        return {
          ok: false,
          message: isBn
            ? 'উভয় আবেদনই যাচাইকৃত হয়েছে; কনকারেন্সি রেস কন্ডিশন প্রতিরোধ করা যায়নি।'
            : 'Both requests were verified; race condition was not prevented.',
        };
      }

      if (heldCount === 2) {
        return {
          ok: false,
          message: isBn
            ? 'উভয় আবেদনই স্থগিত (held) হয়েছে; কোনো আবেদনই প্রাথমিক লক পায়নি।'
            : 'Both requests were held; neither acquired initial write lock.',
        };
      }

      if (verifiedCount === 1 && heldCount === 1) {
        const heldItem = heldItems[0];
        const findings = Array.isArray(heldItem?.findings) ? heldItem.findings : [];
        const hasDoubleSale = findings.some((f: any) => f?.rule_id === 'DOUBLE_SALE');

        if (!hasDoubleSale) {
          const rules = findings.map((f: any) => f?.rule_id || 'unknown').join(', ') || 'none';
          return {
            ok: false,
            message: isBn
              ? `একটি যাচাইকৃত এবং একটি স্থগিত হলেও স্থগিত আবেদনে DOUBLE_SALE পাওয়া যায়নি (পাওয়া গেছে: ${rules})।`
              : `One request verified and one held, but held request lacked DOUBLE_SALE finding (got: ${rules}).`,
          };
        }

        return {
          ok: true,
          message: isBn
            ? 'কনকারেন্সি সংঘাত সঠিকভাবে নিয়ন্ত্রিত: ১টি যাচাইকৃত এবং ১টি DOUBLE_SALE সহ স্থগিত।'
            : 'Race condition resolved correctly: 1 verified, 1 held with DOUBLE_SALE.',
        };
      }

      return {
        ok: false,
        message: isBn
          ? `অপ্রত্যাশিত রেস ফলাফল: ${verifiedCount}টি যাচাইকৃত, ${heldCount}টি স্থগিত।`
          : `Unexpected race outcome: ${verifiedCount} verified, ${heldCount} held.`,
      };
    }

    default:
      return {
        ok: false,
        message: isBn
          ? `অজানা ডেমো ধাপ "${normalizedStep}"।`
          : `Unknown demo step "${normalizedStep}".`,
      };
  }
}
