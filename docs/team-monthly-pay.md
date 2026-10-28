# Fixed monthly pay for team/user accounts

This applies to team accounts such as Ziggy, not business customer billing.

## Install

Run `add-team-monthly-pay.sql` once in the production Supabase SQL Editor before using Monthly pay. It adds default-weekly frequency fields and a unique monthly payout index. It does not change any existing person's pay, create payouts, or send money. Monthly settings fail closed with a setup message until the migration is installed; existing weekly settings keep working.

## Set up an account

1. Superadmin: Admin → Team Management → Members → Edit the user.
2. Set Pay frequency to Monthly — fixed amount.
3. Enter the monthly amount and USD or CRC. Changing frequency clears the amount; enter the agreed amount explicitly.
4. For fixed pay only, set Commission rate to 0%.
5. Save user.

## Record each month's pay

1. Team Management → Payouts → Fixed monthly pay.
2. Choose the person and calendar month → Generate monthly pay.
3. Review the Pending payout and Approve it. Approval uses the existing payslip/accounting email flow.
4. After paying outside the application, use Record payment with the payment reference/receipt.

Generation is manual. It creates one Pending record per person and Costa Rica calendar month, not a bank transfer or a recurring card charge. Future months are refused. Commissions are calculated separately by the existing weekly scan. Monthly salary does not enter weekly salary estimates, and commission refund adjustments do not reduce fixed monthly pay. Existing Pending/Approved/Paid monthly records are not overwritten by generation. A rejected record can be replaced. The database unique index prevents duplicates even with simultaneous requests.

Changing an account's amount applies to newly generated months. Edit an existing Pending payout separately if the agreed amount for that month needs correction; paid records stay unchanged.
