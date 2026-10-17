/**
 * GET  /api/transfers   - list transfers (reviewers see all, applicants see only their own)
 * POST /api/transfers   - create a new transfer (runs the 3 detection rules)
 *
 * The POST body may include a deed date + deed fields so the deed and the transfer are
 * inserted atomically in the same transaction.
 *
 * Errors: every failure goes through handleApiError -> 400/401/403/404/409, or a
 * generic 500 (never raw database messages).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, withTransaction } from '@/../db';
import { createTransfer, InlineDeedFields } from '@/lib/workflow/transfer-service';
import { requireAuth, requireRole } from '@/lib/auth';
import { MutationApplication } from '@/lib/rules/types';
import { handleApiError } from '@/lib/api-errors';
import { BadRequestError } from '@/lib/errors';

/** Reads a required, non-empty text field from the JSON body. */
function requireText(body: any, key: string): string {
  const value = body?.[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BadRequestError(`Field "${key}" is required.`);
  }
  return value.trim();
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const pool = getPool();
    const { searchParams } = new URL(req.url);
    const parcelId = searchParams.get('parcel_id');
    const status   = searchParams.get('status');

    let queryText = 'SELECT * FROM transfers';
    const params: any[] = [];
    const conditions: string[] = [];

    // Applicants may only ever see their OWN applications (enforced here, not in the browser).
    if (user.role === 'applicant') {
      params.push(user.username);
      conditions.push(`applicant_username = $${params.length}`);
    }
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
  } catch (err) {
    return handleApiError(err, 'GET /api/transfers');
  }
}

export async function POST(req: NextRequest) {
  try {
    // Applicants and reviewers may submit; anyone else gets 403 (and it is logged).
    const currentUser = await requireRole(['applicant', 'reviewer'], req);

    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new BadRequestError('Request body must be valid JSON.');
    }

    const parcelId   = requireText(body, 'parcel_id');
    const deedNumber = requireText(body, 'deed_number');
    const sellerName = requireText(body, 'seller_name');
    const buyerName  = requireText(body, 'buyer_name');
    const area       = Number(body.application_area_decimal);
    if (!Number.isFinite(area) || area <= 0) {
      throw new BadRequestError('Field "application_area_decimal" must be a positive number.');
    }

    // Fetch actor's private key from DB (needed for audit signing).
    // NEVER return private_key from any API endpoint.
    const pool = getPool();
    const keyRes = await pool.query(
      'SELECT private_key FROM users WHERE username = $1;',
      [currentUser.username]
    );
    const actorPrivKey = keyRes.rows[0]?.private_key as string | undefined;
    if (!actorPrivKey) {
      throw new Error('Actor signing key not found. Run migrations and seed first.');
    }

    const application: MutationApplication = {
      parcel_id:                parcelId,
      deed_number:              deedNumber,
      applicant_username:       currentUser.username,
      seller_name:              sellerName,
      seller_nid:               String(body.seller_nid ?? ''),
      buyer_name:               buyerName,
      buyer_nid:                String(body.buyer_nid ?? ''),
      application_mouza:        String(body.application_mouza ?? ''),
      application_khatian:      String(body.application_khatian ?? ''),
      application_dag:          String(body.application_dag ?? ''),
      application_area_decimal: area,
    };

    // Optional inline deed (only when a deed date is supplied).
    let inlineDeed: InlineDeedFields | undefined;
    if (body.deed_date) {
      inlineDeed = {
        deed_number:  deedNumber,
        parcel_id:    parcelId,
        seller_name:  sellerName,
        seller_nid:   application.seller_nid,
        buyer_name:   buyerName,
        buyer_nid:    application.buyer_nid,
        mouza:        application.application_mouza,
        khatian:      application.application_khatian,
        dag:          application.application_dag,
        area_decimal: area,
        deed_date:    String(body.deed_date),
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
  } catch (err) {
    return handleApiError(err, 'POST /api/transfers');
  }
}
