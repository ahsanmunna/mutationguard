
/**
 * GET  /api/transfers   - list transfers (reviewers see all, applicants see only their own)
 * POST /api/transfers   - create a new transfer (runs the 3 detection rules)
 *
 * The POST body may include deed fields so the deed and the transfer are
 * inserted atomically in the same transaction.
 *
 * Errors: every failure goes through handleApiError -> 400/401/403/404/409, or a
 * generic 500 (never raw database messages).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, withTransaction } from '@/../db';
import { createTransfer } from '@/lib/workflow/transfer-service';
import { parseInlineDeed } from '@/lib/workflow/inline-deed';
import { optionalText, requirePositiveNumber, requireText } from '@/lib/validation';
import { requireAuth, requireRole } from '@/lib/auth';
import { MutationApplication } from '@/lib/rules/types';
import { handleApiError } from '@/lib/api-errors';
import { BadRequestError } from '@/lib/errors';

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

    // Every field is length- and type-checked here, before anything touches the database.
    // (deed_number is limited to 50 characters because the audit ledger stores it as an entity id.)
    const parcelId   = requireText(body, 'parcel_id', 50);
    const deedNumber = requireText(body, 'deed_number', 50);
    const sellerName = requireText(body, 'seller_name', 100);
    const buyerName  = requireText(body, 'buyer_name', 100);
    const area       = requirePositiveNumber(body, 'application_area_decimal');

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
      seller_nid:               optionalText(body, 'seller_nid', 50),
      buyer_name:               buyerName,
      buyer_nid:                optionalText(body, 'buyer_nid', 50),
      application_mouza:        optionalText(body, 'application_mouza', 50),
      application_khatian:      optionalText(body, 'application_khatian', 50),
      application_dag:          optionalText(body, 'application_dag', 50),
      application_area_decimal: area,
    };

    // Optional inline deed. It is built from the DEED fields the user entered (deed_*),
    // never from the application fields, so the two can genuinely differ.
    const inlineDeed = parseInlineDeed(body, {
      parcelId,
      deedNumber,
      sellerName,
      sellerNid: application.seller_nid,
      buyerName,
      buyerNid: application.buyer_nid,
    });

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
