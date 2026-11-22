/**
 * Pure logic and validation functions for the Mutation Application wizard.
 */

export interface RegistryRecordInput {
  mouza?: string;
  khatian?: string;
  dag?: string;
  area_decimal?: number | string;
  current_owner_name?: string;
  current_owner_nid?: string;
  [key: string]: any;
}

export interface DeedRecordInput {
  mouza?: string;
  deed_mouza?: string;
  khatian?: string;
  deed_khatian?: string;
  dag?: string;
  deed_dag?: string;
  area_decimal?: number | string;
  deed_area_decimal?: number | string;
  seller_name?: string;
  seller_nid?: string;
  [key: string]: any;
}

export interface ApplicationRecordInput {
  mouza?: string;
  application_mouza?: string;
  khatian?: string;
  application_khatian?: string;
  dag?: string;
  application_dag?: string;
  area_decimal?: number | string;
  application_area_decimal?: number | string;
  [key: string]: any;
}

export interface ComparisonRow {
  field: 'mouza' | 'khatian' | 'dag' | 'area' | 'seller';
  labelEn: string;
  labelBn: string;
  registry: string;
  deed: string;
  application: string;
  registryValue: string;
  deedValue: string;
  applicationValue: string;
  differs: boolean;
  registrySub?: string;
  deedSub?: string;
}

/**
 * Normalizes text for comparison: trims whitespace and lowercases,
 * mirroring src/lib/rules/engine.ts.
 */
function cleanText(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).trim().toLowerCase();
}

/**
 * Compares numeric area to two decimals,
 * mirroring src/lib/rules/engine.ts (Math.abs(a - b) > 0.001).
 */
function areasDiffer(val1: any, val2: any): boolean {
  const num1 = Number(val1);
  const num2 = Number(val2);
  if (Number.isNaN(num1) || Number.isNaN(num2)) {
    return cleanText(val1) !== cleanText(val2);
  }
  return Math.abs(num1 - num2) > 0.001;
}

/**
 * Compares registry, deed, and application records.
 * Returns rows for mouza, khatian, dag, area, and seller.
 */
export function compareRecords(params: {
  registry: RegistryRecordInput;
  deed: DeedRecordInput;
  application: ApplicationRecordInput;
}): ComparisonRow[] {
  const { registry, deed, application } = params;

  // Extract raw values
  const regMouza = String(registry?.mouza ?? '');
  const deedMouza = String(deed?.mouza ?? deed?.deed_mouza ?? '');
  const appMouza = String(application?.mouza ?? application?.application_mouza ?? '');

  const regKhatian = String(registry?.khatian ?? '');
  const deedKhatian = String(deed?.khatian ?? deed?.deed_khatian ?? '');
  const appKhatian = String(application?.khatian ?? application?.application_khatian ?? '');

  const regDag = String(registry?.dag ?? '');
  const deedDag = String(deed?.dag ?? deed?.deed_dag ?? '');
  const appDag = String(application?.dag ?? application?.application_dag ?? '');

  const regArea = String(registry?.area_decimal ?? '');
  const deedArea = String(deed?.area_decimal ?? deed?.deed_area_decimal ?? '');
  const appArea = String(application?.area_decimal ?? application?.application_area_decimal ?? '');

  const regOwner = String(registry?.current_owner_name ?? '');
  const deedSeller = String(deed?.seller_name ?? '');

  const regOwnerNid = String(registry?.current_owner_nid ?? '');
  const deedSellerNid = String(deed?.seller_nid ?? '');

  // Mouza comparison: differs ONLY when deed mouza differs from registry mouza.
  // Show the application mouza in its column but never count it as a difference (the engine does not compare it).
  const mouzaDiffers = cleanText(regMouza) !== cleanText(deedMouza);

  // Khatian comparison: differs when deed differs from registry OR application differs from deed.
  const khatianDiffers =
    cleanText(regKhatian) !== cleanText(deedKhatian) ||
    cleanText(appKhatian) !== cleanText(deedKhatian);

  // Dag comparison: differs when deed differs from registry OR application differs from deed.
  const dagDiffers =
    cleanText(regDag) !== cleanText(deedDag) ||
    cleanText(appDag) !== cleanText(deedDag);

  // Area comparison: differs when deed differs from registry OR application differs from deed.
  const areaDiffers =
    areasDiffer(regArea, deedArea) ||
    areasDiffer(appArea, deedArea);

  // Seller comparison: differs when the deed seller name differs from the registry owner name
  // OR (both the deed seller NID and the registry owner NID are non-empty and differ after trim).
  const isNameMismatch = cleanText(regOwner) !== cleanText(deedSeller);
  const isNidMismatch = Boolean(
    regOwnerNid.trim() !== '' &&
    deedSellerNid.trim() !== '' &&
    regOwnerNid.trim() !== deedSellerNid.trim()
  );
  const sellerDiffers = isNameMismatch || isNidMismatch;

  const rows: ComparisonRow[] = [
    {
      field: 'mouza',
      labelEn: 'Mouza',
      labelBn: 'মৌজা',
      registry: regMouza,
      deed: deedMouza,
      application: appMouza,
      registryValue: regMouza,
      deedValue: deedMouza,
      applicationValue: appMouza,
      differs: mouzaDiffers,
    },
    {
      field: 'khatian',
      labelEn: 'Khatian',
      labelBn: 'খতিয়ান',
      registry: regKhatian,
      deed: deedKhatian,
      application: appKhatian,
      registryValue: regKhatian,
      deedValue: deedKhatian,
      applicationValue: appKhatian,
      differs: khatianDiffers,
    },
    {
      field: 'dag',
      labelEn: 'Dag No.',
      labelBn: 'দাগ নং',
      registry: regDag,
      deed: deedDag,
      application: appDag,
      registryValue: regDag,
      deedValue: deedDag,
      applicationValue: appDag,
      differs: dagDiffers,
    },
    {
      field: 'area',
      labelEn: 'Area (Decimal)',
      labelBn: 'জমির পরিমাণ (শতক)',
      registry: regArea,
      deed: deedArea,
      application: appArea,
      registryValue: regArea,
      deedValue: deedArea,
      applicationValue: appArea,
      differs: areaDiffers,
    },
    {
      field: 'seller',
      labelEn: 'Seller / Owner',
      labelBn: 'বিক্রেতা / মালিক',
      registry: regOwner,
      deed: deedSeller,
      application: '—',
      registryValue: regOwner,
      deedValue: deedSeller,
      applicationValue: '—',
      differs: sellerDiffers,
      registrySub: regOwnerNid.trim() || undefined,
      deedSub: deedSellerNid.trim() || undefined,
    },
  ];

  return rows;
}

/**
 * Returns the number of differing rows in a comparison.
 */
export function countDifferences(rows: ComparisonRow[]): number {
  return rows.filter((r) => r.differs).length;
}

export const countDifferingRows = countDifferences;

/**
 * Validates the fields for a specific wizard step.
 * Returns a map of fieldName -> errorMessage.
 */
export function validateWizardStep(
  step: number,
  formData: Record<string, any>,
  language: string = 'en'
): Record<string, string> {
  const bn = language === 'bn';
  const errors: Record<string, string> = {};

  const msg = {
    required: (nameEn: string, nameBn: string) =>
      bn ? `${nameBn} আবশ্যক।` : `${nameEn} is required.`,
    maxLen: (nameEn: string, nameBn: string, max: number) =>
      bn ? `${nameBn} সর্বোচ্চ ${max} অক্ষরের মধ্যে হতে হবে।` : `${nameEn} must be at most ${max} characters.`,
    positiveNumber: (nameEn: string, nameBn: string) =>
      bn ? `${nameBn} একটি সঠিক ধনাত্মক সংখ্যা হতে হবে।` : `${nameEn} must be a positive number.`,
    invalidDate: (nameEn: string, nameBn: string) =>
      bn ? `${nameBn} একটি সঠিক তারিখ হতে হবে (YYYY-MM-DD)।` : `${nameEn} must be a valid date in YYYY-MM-DD format.`,
  };

  if (step === 1) {
    // parcel_id
    if (!formData.parcel_id || typeof formData.parcel_id !== 'string' || !formData.parcel_id.trim()) {
      errors.parcel_id = msg.required('Parcel', 'জমির প্লট');
    }

    // buyer_name
    if (!formData.buyer_name || typeof formData.buyer_name !== 'string' || !formData.buyer_name.trim()) {
      errors.buyer_name = msg.required('Buyer Name', 'ক্রেতার নাম');
    } else if (formData.buyer_name.trim().length > 100) {
      errors.buyer_name = msg.maxLen('Buyer Name', 'ক্রেতার নাম', 100);
    }

    // buyer_nid
    if (!formData.buyer_nid || typeof formData.buyer_nid !== 'string' || !formData.buyer_nid.trim()) {
      errors.buyer_nid = msg.required('Buyer NID', 'ক্রেতার এনআইডি');
    } else if (formData.buyer_nid.trim().length > 50) {
      errors.buyer_nid = msg.maxLen('Buyer NID', 'ক্রেতার এনআইডি', 50);
    }
  } else if (step === 2) {
    // deed_number
    if (!formData.deed_number || typeof formData.deed_number !== 'string' || !formData.deed_number.trim()) {
      errors.deed_number = msg.required('Deed Number', 'দলিল নম্বর');
    } else if (formData.deed_number.trim().length > 50) {
      errors.deed_number = msg.maxLen('Deed Number', 'দলিল নম্বর', 50);
    }

    // deed_date
    if (!formData.deed_date || typeof formData.deed_date !== 'string' || !formData.deed_date.trim()) {
      errors.deed_date = msg.required('Deed Date', 'দলিলের তারিখ');
    } else {
      const dateStr = formData.deed_date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        errors.deed_date = msg.invalidDate('Deed Date', 'দলিলের তারিখ');
      } else {
        const parsed = new Date(`${dateStr}T00:00:00Z`);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateStr) {
          errors.deed_date = msg.invalidDate('Deed Date', 'দলিলের তারিখ');
        }
      }
    }

    // seller_name
    if (!formData.seller_name || typeof formData.seller_name !== 'string' || !formData.seller_name.trim()) {
      errors.seller_name = msg.required('Seller Name', 'বিক্রেতার নাম');
    } else if (formData.seller_name.trim().length > 100) {
      errors.seller_name = msg.maxLen('Seller Name', 'বিক্রেতার নাম', 100);
    }

    // seller_nid
    if (!formData.seller_nid || typeof formData.seller_nid !== 'string' || !formData.seller_nid.trim()) {
      errors.seller_nid = msg.required('Seller NID', 'বিক্রেতার এনআইডি');
    } else if (formData.seller_nid.trim().length > 50) {
      errors.seller_nid = msg.maxLen('Seller NID', 'বিক্রেতার এনআইডি', 50);
    }

    // deed_mouza
    if (!formData.deed_mouza || typeof formData.deed_mouza !== 'string' || !formData.deed_mouza.trim()) {
      errors.deed_mouza = msg.required('Deed Mouza', 'দলিলের মৌজা');
    } else if (formData.deed_mouza.trim().length > 50) {
      errors.deed_mouza = msg.maxLen('Deed Mouza', 'দলিলের মৌজা', 50);
    }

    // deed_khatian
    if (!formData.deed_khatian || typeof formData.deed_khatian !== 'string' || !formData.deed_khatian.trim()) {
      errors.deed_khatian = msg.required('Deed Khatian', 'দলিলের খতিয়ান');
    } else if (formData.deed_khatian.trim().length > 50) {
      errors.deed_khatian = msg.maxLen('Deed Khatian', 'দলিলের খতিয়ান', 50);
    }

    // deed_dag
    if (!formData.deed_dag || typeof formData.deed_dag !== 'string' || !formData.deed_dag.trim()) {
      errors.deed_dag = msg.required('Deed Dag', 'দলিলের দাগ');
    } else if (formData.deed_dag.trim().length > 50) {
      errors.deed_dag = msg.maxLen('Deed Dag', 'দলিলের দাগ', 50);
    }

    // deed_area_decimal
    if (
      formData.deed_area_decimal === undefined ||
      formData.deed_area_decimal === null ||
      String(formData.deed_area_decimal).trim() === ''
    ) {
      errors.deed_area_decimal = msg.required('Deed Area', 'দলিলের জমির পরিমাণ');
    } else {
      const num = Number(formData.deed_area_decimal);
      if (Number.isNaN(num) || !Number.isFinite(num) || num <= 0 || num > 100000) {
        errors.deed_area_decimal = msg.positiveNumber('Deed Area', 'দলিলের জমির পরিমাণ');
      }
    }
  } else if (step === 3) {
    // application_mouza
    if (!formData.application_mouza || typeof formData.application_mouza !== 'string' || !formData.application_mouza.trim()) {
      errors.application_mouza = msg.required('Application Mouza', 'আবেদনকৃত মৌজা');
    } else if (formData.application_mouza.trim().length > 50) {
      errors.application_mouza = msg.maxLen('Application Mouza', 'আবেদনকৃত মৌজা', 50);
    }

    // application_khatian
    if (!formData.application_khatian || typeof formData.application_khatian !== 'string' || !formData.application_khatian.trim()) {
      errors.application_khatian = msg.required('Application Khatian', 'আবেদনকৃত খতিয়ান');
    } else if (formData.application_khatian.trim().length > 50) {
      errors.application_khatian = msg.maxLen('Application Khatian', 'আবেদনকৃত খতিয়ান', 50);
    }

    // application_dag
    if (!formData.application_dag || typeof formData.application_dag !== 'string' || !formData.application_dag.trim()) {
      errors.application_dag = msg.required('Application Dag', 'আবেদনকৃত দাগ');
    } else if (formData.application_dag.trim().length > 50) {
      errors.application_dag = msg.maxLen('Application Dag', 'আবেদনকৃত দাগ', 50);
    }

    // application_area_decimal
    if (
      formData.application_area_decimal === undefined ||
      formData.application_area_decimal === null ||
      String(formData.application_area_decimal).trim() === ''
    ) {
      errors.application_area_decimal = msg.required('Application Area', 'আবেদনকৃত জমির পরিমাণ');
    } else {
      const num = Number(formData.application_area_decimal);
      if (Number.isNaN(num) || !Number.isFinite(num) || num <= 0 || num > 100000) {
        errors.application_area_decimal = msg.positiveNumber('Application Area', 'আবেদনকৃত জমির পরিমাণ');
      }
    }
  }

  return errors;
}

/**
 * Validates all fields across all steps.
 */
export function validateAllWizardSteps(
  formData: Record<string, any>,
  language: string = 'en'
): Record<string, string> {
  return {
    ...validateWizardStep(1, formData, language),
    ...validateWizardStep(2, formData, language),
    ...validateWizardStep(3, formData, language),
  };
}
