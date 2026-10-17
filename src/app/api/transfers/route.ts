/**
 * GET  /api/transfers      — list transfers (optionally filtered by parcel_id, status)
 * POST /api/transfers      — create a new transfer (runs 3 detection rules)
 *
 * The POST body may include optional inline deed fields so the deed and transfer
 * are inserted atomically in the same transaction.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, withTransaction } from '@/../db';
import { createTransfer, InlineDeedFields } from '@/lib/workflow/transfer-service';
import { requireRole } from '@/lib/auth';
import { MutationApplication } from '@/lib/rules/types';
import { sanitizeErrorMessage } from '@/../db/safety';

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcel_id');
    const status   = searchParams.get('status');

    let queryText = 'SELECT * FROM transfers';
    const params: any[]      = [];
    const conditions: string[] = [];

    if (parcelId) {
      params.push(parcelId);
      conditions.push(`parcel_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) queryText += ' WHERE ' + conditions.join(' AND ');
    queryText += ' ORDER BY created_at DESC;';

    const result = await pool.query(queryText, params);
    return NextResponse.json({ transfers: result.rows });
  } catch (err: any) {
    console.error('Error fetching transfers:', sanitizeErrorMessage(err.message));
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Stage A auth stub — requires applicant or reviewer role
    const currentUser = await requireRole(['applicant', 'reviewer'], req);

    const body = await req.json();

    // Fetch actor's private key from DB (needed for audit signing)
    // NEVER return private_key from any API endpoint.
    const pool  = getPool();
    const keyRes = await pool.query(
      'SELECT private_key FROM users WHERE username = $1;',
      [currentUser.username]
    );
    if (!keyRes.rows[0]?.private_key) {
      return NextResponse.json({ error: 'Actor key not found. Run migrations and seed first.' }, { status: 500 });
    }
    const actorPrivKey = keyRes.rows[0].private_key as string;

    const application: MutationApplication = {
      parcel_id:               body.parcel_id,
      deed_number:             body.deed_number,
      applicant_username:      currentUser.username,
      seller_name:             body.seller_name,
      seller_nid:              body.seller_nid,
      buyer_name:              body.buyer_name,
      buyer_nid:               body.buyer_nid,
      application_mouza:       body.application_mouza,
      application_khatian:     body.application_khatian,
      application_dag:         body.application_dag,
      application_area_decimal: body.application_area_decimal,
    };

    // Optional inline deed fields (Phase 3)
    let inlineDeed: InlineDeedFields | undefined;
    if (body.deed_date) {
      inlineDeed = {
        deed_number:  body.deed_number,
        parcel_id:    body.parcel_id,
        seller_name:  body.seller_name,
        seller_nid:   body.seller_nid,
        buyer_name:   body.buyer_name,
        buyer_nid:    body.buyer_nid,
        mouza:        body.application_mouza,
        khatian:      body.application_khatian,
        dag:          body.application_dag,
        area_decimal: Number(body.application_area_decimal),
        deed_date:    body.deed_date,
      };
    }

    const result = await withTransaction(async (client) => {
      return createTransfer(client, application, currentUser, actorPrivKey, inlineDeed);
    });

    return NextResponse.json({
      success:     true,
      transfer_id: result.transfer_id,
      status:      result.status,
      findings:    result.findings,
    });
  } catch (err: any) {
    console.error('Error creating transfer:', sanitizeErrorMessage(err.message));
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
