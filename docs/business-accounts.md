# Business accounts rollout

1. Run `business-accounts.sql` in the same Supabase project after `customer-accounts-foundation.sql`.
2. Set `NEXT_PUBLIC_ACCOUNTS_LIVE=true` and rebuild to make customer sign-in and dashboards publicly accessible. Existing account preview remains available for staging.
3. Verify transactional `ORDER_SMTP_*` settings and the canonical `NEXT_PUBLIC_SITE_URL`. Also configure `OWN_DOMAIN_SMTP_*` for delivery to the company's Rackspace inbox. The existing request-code flow verifies mailbox ownership; welcome and order emails reuse the existing customer flow.
4. As the superadmin, open Customers → Customer accounts → Business accounts. Enter the company, dedicated buyer email, 10-digit cédula jurídica, contact, addresses and agreed percentage. Save as Approved, then click Send invitation. Saving alone sends no email.
5. The buyer signs in using the existing email-code flow and opens `/account/business`. Orders, delivery tracking, addresses and support remain in the customer account area.
6. New buyers may apply at `/account/business` after signing in. Applications remain pending with zero discount until approved. They receive a branded application receipt; delivery failures are surfaced without losing the application. Send the invitation after approval to confirm the terms.

Pricing applies to non-BAC merchandise and excludes shipping. The best total of business pricing and existing public offers wins; business terms never stack with another offer. Both catalog checkout and order creation use the same pricing engine. Suspended accounts lose business pricing on subsequent orders, while retaining ordinary customer account access.

Company identity and pricing changes require owner review. One verified buyer mailbox is supported per company in this version; multiple employee logins, per-product contracts and tax invoice generation are not implemented. Corporation numbers are format-checked, not verified against a government registry.

Before launch: create a test business with a mailbox you control; confirm invitation delivery, sign-in code delivery, dashboard access, both currencies, a better public offer, and suspension. Check that a second customer cannot access the company. No production invitations are sent by the implementation task.

## Signup alerts

New business registrations, whether submitted by the buyer or created by the owner, send separate alerts to `omerforce@gmail.com` and `info@peptidescostarica.net`. The info copy uses own-domain SMTP; the Omer copy uses transactional SMTP. Customer acknowledgements are separate messages. An unsuccessful staff alert does not discard the business account or the other successful delivery. The owner can use **Resend staff alert** in Business accounts after correcting SMTP configuration. SMTP acceptance is not proof that a message reached the inbox.

## Passwords and recovery

Email-code sign-in remains available for first-time registration. After verifying their email, a customer can set a password under **You → Login & security** (`/account/security`). Password login is available on the sign-in screen. **Forgot password** verifies an email code and then opens the password settings page; recovery does not depend on a pre-existing password. Passwords must match and contain 12–128 characters. A recent sign-in is checked before updates; older sessions are directed back to email verification. Successful password updates attempt to revoke other device sessions and report any failure separately. Supabase remains the password authority; credentials are never stored in business profiles or emailed to staff.
