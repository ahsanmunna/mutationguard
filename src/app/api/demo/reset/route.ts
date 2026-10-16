import { NextRequest, NextResponse } from 'next/server';
import { runSeed } from '@/../db/seed';
import { requireRole } from '@/lib/auth';

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
  } catch (err: any) {
    console.error('Error during demo reset:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
