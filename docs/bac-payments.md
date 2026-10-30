# BAC catalog payments

Both checkout methods default to **Coming soon**. No account details are seeded.

Before activation:

1. Apply `add-bac-payment-settings-security.sql` in Supabase. It prevents direct client access to BAC configuration through existing broad site_settings policies. Server routes use the service role; configuration routes require superadmin access.
2. Open **Admin → Orders → BAC · SINPE & bank transfers**.
3. Enter the recipient name, legal ID, registered business SINPE number and BAC CRC IBAN. Save with both switches off while mobile banking is being set up. Never enter banking passwords or OTPs.
4. Once the account is ready, enable the intended method and run a small real payment through checkout. Confirm the recipient shown by the customer's bank matches the business, check receipt in BAC, and verify the order in admin.

New bank-payment orders remain Pending and use the server-calculated CRC amount. Account details and amount are saved on the order, so later settings changes do not rewrite existing instructions. Inventory follows the existing paid-order workflow; pending orders do not reserve stock.

Customers receive a seven-day signed payment page, with copy buttons, payer name and transaction reference reporting. The token stays in the URL fragment. Reporting a payment never marks an order paid. The admin verification queue shows reported payments; staff confirms funds in BAC and uses the existing paid transition, including inventory and customer confirmation. Refresh the Orders ledger after confirming through this queue.

Payment reporting does not accept receipt uploads; staff can attach receipts using the existing order proof uploader. Verification is manual. There is no BAC API, automatic account debit, or automatic bank reconciliation in this release.

An optional server-only `BANK_PAYMENT_TOKEN_SECRET` signs links; otherwise the existing Supabase service-role key is used. Rotating that signing secret invalidates outstanding bank payment links. Payment links expire after seven days; staff should coordinate older orders directly. Disable either switch to stop new orders using that method; existing payment instructions remain accessible for pending orders.
