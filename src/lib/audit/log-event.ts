/**
 * logAuditEventSafe: write ONE audit event in its OWN committed transaction.
 *
 * When to use it:
 *   - Security events (403 attempts, unauthenticated access)
 *   - "Blocked" events (skipped stage, stale finalize) that happen when the MAIN
 *     transaction rolls back. If we wrote them inside it, they would be rolled back too.
 *
 * How the signing works (this fixes a real bug):
 *   The event is ALWAYS signed with the key of the actor named in the event
 *   (actor_username). The verifier checks every signature against that same actor's
 *   registered public key, so signer and actor can never disagree.
 *   For events with no real user (e.g. unauthenticated access) use the seeded
 *   'system_audit' user as the actor.
 *
 * It never throws: logging must not turn a 403 into a 500. Failures go to the server log.
 */
import { withTransaction } from '../../../db';
import { sanitizeErrorMessage } from '../../../db/safety';
import { appendAuditEvent, AuditEventInput } from './ledger';

export async function logAuditEventSafe(input: AuditEventInput): Promise<boolean> {
  try {
    await withTransaction(async (client) => {
      const keyRes = await client.query(
        'SELECT private_key FROM users WHERE username = $1;',
        [input.actor_username]
      );
      const privateKey = keyRes.rows[0]?.private_key as string | undefined;
      if (!privateKey) {
        throw new Error(`no signing key for actor "${input.actor_username}"`);
      }
      await appendAuditEvent(client, input, privateKey);
    });
    return true;
  } catch (err: any) {
    console.error('[AUDIT] could not write event', input.event_type, ':', sanitizeErrorMessage(err?.message || String(err)));
    return false;
  }
}
