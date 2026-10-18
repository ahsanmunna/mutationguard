import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { verifyAuditChain } from '@/lib/audit/ledger';
import { verifyDeedAnchors } from '@/lib/audit/integrity';
import { handleApiError } from '@/lib/api-errors';
import { NotFoundError } from '@/lib/errors';
import { generateQrCodeDataUrl } from '@/lib/qrcode/generator';

/**
 * Public Verification Endpoint (No Authentication Required)
 *
 * GET /api/public/verify/[id]
 * Allows any citizen or authority to independently verify a land mutation,
 * its deed anchor, ownership history and tamper-evident audit status.
 * Only public fields are returned (no keys, no hashes of private data).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = getPool();

    // 1. Fetch transfer details with joined parcel and deed
    const transferRes = await pool.query(
      `SELECT t.*,
              p.mouza as parcel_mouza, p.khatian as parcel_khatian,
              p.dag as parcel_dag, p.area_decimal as parcel_area,
              p.current_owner_name as parcel_current_owner,
              p.current_owner_nid as parcel_current_owner_nid,
              d.deed_number as registry_deed_number,
              d.deed_date as registry_deed_date,
              d.deed_hash, d.deed_json,
              d.seller_name as deed_seller_name, d.seller_nid as deed_seller_nid,
              d.buyer_name as deed_buyer_name, d.buyer_nid as deed_buyer_nid,
              d.area_decimal as deed_area, d.mouza as deed_mouza,
              d.khatian as deed_khatian, d.dag as deed_dag
       FROM transfers t
       JOIN parcels p ON t.parcel_id = p.id
       LEFT JOIN deeds d ON t.deed_id = d.id
       WHERE t.id = $1;`,
      [id]
    );

    if (transferRes.rowCount === 0) {
      throw new NotFoundError('Transfer record not found');
    }

    const row = transferRes.rows[0];

    // 2. Fetch finalization audit block (if finalized)
    const auditRes = await pool.query(
      `SELECT sequence_num, event_type, entity_id, actor_username, actor_role,
              payload, payload_hash, record_hash, timestamp
       FROM audit_ledger
       WHERE entity_id = $1 AND event_type = 'TRANSFER_FINALIZED'
       LIMIT 1;`,
      [id]
    );
    const finalizationRecord = auditRes.rows[0] || null;

    // 3. Ownership history of the parcel (oldest first)
    const historyRes = await pool.query(
      `SELECT previous_owner_name, new_owner_name, transfer_id, deed_number, recorded_at
       FROM ownership_history
       WHERE parcel_id = $1
       ORDER BY recorded_at ASC, id ASC;`,
      [row.parcel_id]
    );

    // 4. Real integrity check for THIS record: the whole chain must verify AND this
    //    transfer's deed must still match the anchor stored in the chain.
    const chain = await verifyAuditChain(pool);
    const deedCheck = await verifyDeedAnchors(pool, row.deed_number);

    let failure: { kind: 'chain' | 'deed'; record_id: string; field: string } | null = null;
    let belongsToThisRecord = false;

    if (!chain.valid) {
      failure = { kind: 'chain', record_id: `Block #${chain.sequence_num}`, field: chain.field };
      const failingBlock = await pool.query(
        'SELECT entity_id FROM audit_ledger WHERE sequence_num = $1;',
        [chain.sequence_num]
      );
      const entity = failingBlock.rows[0]?.entity_id;
      belongsToThisRecord =
        entity === row.id || entity === row.deed_number || entity === row.parcel_id;
    } else if (deedCheck.failure) {
      failure = { kind: 'deed', record_id: deedCheck.failure.record_id, field: deedCheck.failure.field };
      belongsToThisRecord = true; // we only checked THIS transfer's deed
    }

    const integrityOk = failure === null;
    const integrity = {
      status: integrityOk ? 'OK' : 'FAIL',
      chain_valid: chain.valid,
      deed_valid: deedCheck.failure === null,
      total_records: chain.valid ? chain.total_records : null,
      failure,
      failure_belongs_to_this_record: belongsToThisRecord,
    };
    const isDeedAnchored = chain.valid && deedCheck.failure === null && deedCheck.deeds_checked === 1;

    // 5. Generate QR code pointing to public verification page
        // Use the configured public URL if there is one, otherwise the address this request came to
    // (so QR codes on the hosted site point at the hosted site, not at localhost).
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '');
    const verifyUrl = `${appUrl}/verify/${id}`;
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await generateQrCodeDataUrl(verifyUrl);
    } catch {
      // Non-fatal if QR fails
    }

    return NextResponse.json({
      transfer: {
        id: row.id,
        parcel_id: row.parcel_id,
        deed_number: row.deed_number,
        status: row.status,
        seller_name: row.seller_name,
        seller_nid: row.seller_nid,
        buyer_name: row.buyer_name,
        buyer_nid: row.buyer_nid,
        application_mouza: row.application_mouza,
        application_khatian: row.application_khatian,
        application_dag: row.application_dag,
        application_area_decimal: row.application_area_decimal,
        findings: row.findings,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      parcel: {
        id: row.parcel_id,
        mouza: row.parcel_mouza,
        khatian: row.parcel_khatian,
        dag: row.parcel_dag,
        area_decimal: row.parcel_area,
        current_owner_name: row.parcel_current_owner,
        current_owner_nid: row.parcel_current_owner_nid,
      },
      deed: {
        deed_number: row.deed_number,
        deed_date: row.registry_deed_date,
        deed_hash: row.deed_hash,
        is_anchored: isDeedAnchored,
      },
      ownership_history: historyRes.rows,
      integrity,
      finalization_audit_record: finalizationRecord,
      is_deed_anchored: isDeedAnchored,
      verification_url: verifyUrl,
      qr_code_data_url: qrCodeDataUrl,
    });
  } catch (err) {
    return handleApiError(err, 'GET /api/public/verify/[id]');
  }
}
