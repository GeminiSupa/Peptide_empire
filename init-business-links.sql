-- init-business-links.sql
-- Run this script in the Supabase SQL Editor to initialize the business_links settings.

INSERT INTO public.site_settings (id, value)
VALUES (
  'business_links',
  '{
    "whatsappNumber": "50660604775",
    "whatsappDisplay": "+506 6060-4775",
    "googleMapsUrl": "",
    "facebookUrl": "",
    "instagramUrl": "",
    "trustpilotUrl": "https://www.trustpilot.com/review/peptidescostarica.net",
    "trustpilotUrlEn": "https://www.trustpilot.com/review/peptidescostarica.net",
    "trustpilotUrlEs": "https://es.trustpilot.com/review/peptidescostarica.net",
    "googleReviewUrl": "",
    "supportEmail": "support@peptidescostarica.net"
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
