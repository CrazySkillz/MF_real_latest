import type { IStorage } from '../storage';

/**
 * Generate a unique email address for a campaign based on its name
 * Format: {campaign-slug}@import.mforensics.com
 * If duplicate, appends -2, -3, etc.
 */
export async function generateCampaignEmail(campaignName: string, storage: IStorage): Promise<string> {
  // 1. Create base slug from campaign name
  const baseSlug = campaignName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with dash
    .replace(/^-+|-+$/g, '')       // Remove leading/trailing dashes
    .replace(/-+/g, '-')           // Replace multiple dashes with single dash
    .substring(0, 50);              // Limit length to 50 chars
  
  // Handle empty slug
  if (!baseSlug) {
    const domain = process.env.EMAIL_DOMAIN || 'import.mforensics.com';
    return `campaign-${Date.now()}@${domain}`;
  }
  
  // 2. Check if email already exists and find available suffix
  let slug = baseSlug;
  let suffix = 1;
  // Use environment variable for domain (allows switching between test and production)
  // For testing: sandboxXXXXXXXX.mailgun.org
  // For production: import.yourdomain.com
  const domain = process.env.EMAIL_DOMAIN || 'import.mforensics.com';
  
  // Try base slug first
  let email = `${slug}@${domain}`;
  let existingIntegration = await storage.getCustomIntegrationByEmail(email);
  
  // If taken, try with suffix
  while (existingIntegration) {
    suffix++;
    slug = `${baseSlug}-${suffix}`;
    email = `${slug}@${domain}`;
    existingIntegration = await storage.getCustomIntegrationByEmail(email);
  }
  
  console.log(`[Email Generator] Generated email for "${campaignName}": ${email}`);
  return email;
}

/**
 * Extract campaign email from various email formats
 * Handles: recipient@domain, "Name" <recipient@domain>, etc.
 */
export function extractEmailAddress(emailString: string): string {
  // Match email pattern
  const match = emailString.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
  return match ? match[1] : emailString;
}

