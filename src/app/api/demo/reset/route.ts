import { NextRequest, NextResponse } from 'next/server';
import { runSeed } from '@/../db/seed';
import { requireRole } from '@/lib/auth';
import { handleApiError } from '@/lib/api-errors';
// Re-seeding talks to the hosted database several times, so allow more than the default time.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Demo mode is not enabled' }, { status: 403 });
  }

  try {
    await requireRole(['reviewer'], req);
    console.log('[Demo] Resetting demo database to initial seed baseline...');
    await runSeed();
    return NextResponse.json({
      success: true,
      message: 'Demo state successfully reset to initial seed baseline.',
    });
  } catch (err) {
    return handleApiError(err, 'POST /api/demo/reset');
  }
}
