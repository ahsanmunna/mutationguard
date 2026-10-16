import { NextRequest, NextResponse } from 'next/server';
import { getPool, withTransaction } from '@/../db';
import { createTransfer } from '@/lib/workflow/transfer-service';
import { requireAuth, requireRole } from '@/lib/auth';
import { MutationApplication } from '@/lib/rules/types';

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcel_id');
    const status = searchParams.get('status');

    let queryText = 'SELECT * FROM transfers';
    const params: any[] = [];
    const conditions: string[] = [];

    if (parcelId) {
      params.push(parcelId);
      conditions.push(`parcel_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }
    queryText += ' ORDER BY created_at DESC;';

    const result = await pool.query(queryText, params);
    return NextResponse.json({ transfers: result.rows });
  } catch (err: any) {
    console.error('Error fetching transfers:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Stage A role guard: Requires authenticated applicant or reviewer
    const currentUser = await requireRole(['applicant', 'reviewer'], req);

    const body = await req.json();
    const application: MutationApplication = {
      parcel_id: body.parcel_id,
      deed_number: body.deed_number,
      applicant_username: currentUser.username,
      seller_name: body.seller_name,
      seller_nid: body.seller_nid,
      buyer_name: body.buyer_name,
      buyer_nid: body.buyer_nid,
      application_mouza: body.application_mouza,
      application_khatian: body.application_khatian,
      application_dag: body.application_dag,
      application_area_decimal: body.application_area_decimal,
    };

    const result = await withTransaction(async (client) => {
      return createTransfer(client, application, currentUser);
    });

    return NextResponse.json({
      success: true,
      transfer_id: result.transfer_id,
      status: result.status,
      findings: result.findings,
    });
  } catch (err: any) {
    console.error('Error creating transfer:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
