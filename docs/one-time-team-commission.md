# One-time additional team commission

Run `add-order-additional-commission.sql` before deploying this feature. It adds order-level fields and a trigger that prevents direct browser writes to commission allocations. Only the superadmin order endpoint can configure them through the app.

For the Melissa/Korinne sale:

1. Open the existing sale's Details panel.
2. Keep **Credited agent** as Korinne, with her existing commission setting. Leave the Affiliate selector alone.
3. Under **One-time additional team commission**, choose Melissa, set **10%**, and enter the visible commission note, such as “Melissa earned this sale; add a one-time 10% while Korinne stays as agent.”
4. Save. This changes only that order's extra allocation; it does not alter Melissa's profile, the customer owner, business pricing, referral rules, or future orders.

The extra cut follows the same eligible paid statuses and net/refund sales base as existing commissions. The weekly report records it in Melissa's additional/team earnings; Korinne retains her normal direct commission. The per-recipient paid-order index prevents a later period from paying the same allocation again. An old sale assigned an extra commission today is included in the assignment period, rather than being lost in an earlier sales period. If it has not been paid yet when a refund occurs, the current net value is used. If already approved/paid, a later recorded refund creates an accounting adjustment for that recipient.

Allocations can be changed while pending; payout approval rechecks the recipient and rate against the live order. Once the recipient has an approved/reserved payout for this order, changing or removing their extra allocation is blocked and requires a separate accounting adjustment. Notes remain editable. Overlapping parent/team overrides are merged onto one report line so the sales base is not duplicated.

The Affiliate control still represents affiliate attribution. A staff-linked affiliate can change the credited agent; the ownership note field is now visible for that case and its contents are forwarded to the server. It is not the control for a one-time additional staff commission.

This implementation does not itself alter any live sale, apply SQL, approve a payout, or move money. The named sale must be configured after the migration and deployment.
