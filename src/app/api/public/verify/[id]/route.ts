import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/../db';
import { verifyDeedAnchor } from '@/lib/audit/ledger';
import { generateQrCodeDataUrl } from '@/lib/qrcode/generator';

/**
 * Public Verification Endpoint (No Authentication Required)
 *
 * GET /api/public/verify/[id]
 * Allows any citizen or authority to independently verify a land mutation,
 * its deed anchor hash, finalization record, and tamper-evident audit status.
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
      return NextResponse.json({ error: 'Transfer record not found' }, { status: 404 });
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

    // 3. Verify deed anchor
    const deedForVerification = {
      deed_number: row.deed_number,
      parcel_id: row.parcel_id,
      seller_name: row.deed_seller_name || row.seller_name,
      buyer_name: row.deed_buyer_name || row.buyer_name,
      mouza: row.deed_mouza || row.application_mouza,
      khatian: row.deed_khatian || row.application_khatian,
      dag: row.deed_dag || row.application_dag,
      area_decimal: row.deed_area || row.application_area_decimal,
      deed_date: row.registry_deed_date ? new Date(row.registry_deed_date).toISOString().split('T')[0] : '',
      deed_hash: row.deed_hash,
    };
    const isDeedAnchored = verifyDeedAnchor(deedForVerification);

    // 4. Generate QR code pointing to public verification page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
      finalization_audit_record: finalizationRecord,
      is_deed_anchored: isDeedAnchored,
      verification_url: verifyUrl,
      qr_code_data_url: qrCodeDataUrl,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
