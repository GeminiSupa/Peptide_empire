alter table public.orders
  add column if not exists payment_recovery_email_sent_at timestamptz,
  add column if not exists payment_recovery_whatsapp_sent_at timestamptz,
  add column if not exists payment_recovery_reminded_at timestamptz;

create index if not exists orders_payment_recovery_due_idx
  on public.orders (created_at)
  where payment_recovery_reminded_at is null
    and status in ('Declined', 'Pending - Card 3DS', 'Pending - 3DS Card');
