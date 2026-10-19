import { NextResponse } from 'next/server';
import { shopperApprovedDisplayConfig } from '@/lib/shopperApproved.mjs';

/**
 * Public display config for seals and widgets.
 * Returns site id + certificate URL only — never the survey or API token.
 */
export async function GET() {
  const config = shopperApprovedDisplayConfig();
  if (!config) {
    return NextResponse.json({ configured: false }, { status: 404 });
  }
  return NextResponse.json({
    configured: true,
    siteId: config.siteId,
    certificateUrl: config.certificateUrl,
    reviewPagePreset: config.reviewPagePreset,
  });
}
