# ScriptSmith Paid Sync — Subscription Lifecycle Spec

**Status:** Planned (not yet built). Decided 2026-10-11.
**Price point under consideration:** $36/year.

## Core principle

The user's work is THEIRS. ScriptSmith (K_W.) claims no rights to it, ever.
If access is revoked for non-payment, the user always gets their work back.

## Lifecycle

### 1. Signup → Payment → Clock starts
- User creates account and pays the subscription.
- 365-day clock starts at the moment of payment.

### 2. Renewal reminders (final month)
- During the last 30 days before expiry, the user gets a **weekly email**
  reminding them the subscription is due (4 emails total).
- Emails sent via Resend (or Supabase email).

### 3. Expiry → 3-day grace period
- After the 365 days end, the user keeps **full access for 3 more days**.
- Reason: they might be waiting on a paycheck.

### 4. Lockout (grace expired, no payment)
- App access is **revoked** — user cannot open/use ScriptSmith sync.
- Their data is **NOT deleted**. It stays protected in the database.
- The system emails the user a **complete export file** of everything saved
  on their account, so they have their work regardless.
- The data remains stored and waiting for them to return.

### 5. Late payment → access restored
- When the user pays after lockout, access is restored immediately.
- The 365-day clock **restarts from the payment date**.

### 6. Early renewal (payment before expiry)
- If the user renews **before** the current period ends, the new time
  **adds on** to the existing expiry date (it does not reset).
- Example: 60 days remaining + renewal = 425 days from today.

## Technical notes (for implementation)

- Needs a `subscriptions` table in Supabase: user_id, paid_until,
  status (active / grace / locked), stripe/paypal transaction refs.
- Needs a scheduled job (cron) to check expiries daily:
  - Send weekly reminders in final month.
  - Flip to grace at expiry.
  - Flip to locked after 3-day grace.
  - Trigger export email on lock.
- Export format: TBD (JSON + rendered documents, or a single archive file).
- Payment provider: TBD — NOT Stripe, NOT Square (her rules). PayPal likely.
- The "locked" state must be enforced app-side (block sync + library access)
  and ideally with an RLS policy or app-level check.
- Password reset and account recovery must still work while locked
  (user needs to get back in to pay).
