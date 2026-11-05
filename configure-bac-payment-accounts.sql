-- Configure the customer-facing BAC and SINPE payment destinations.
-- Safe to re-run: this replaces only the dedicated BAC payment setting.
INSERT INTO public.site_settings (id, value)
VALUES (
  'bac_payment_settings',
  jsonb_build_object(
    'recipient', 'JOSAWI WEBSTER BAY SOCIEDAD AN',
    'legalId', '',
    'sinpePhone', '60626224',
    'accountCrc', '974562449',
    'ibanCrc', 'CR15010200009745624493',
    'accountUsd', '974562431',
    'ibanUsd', 'CR14010200009745624317',
    'sinpeEnabled', true,
    'transferEnabled', true
  )
)
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
