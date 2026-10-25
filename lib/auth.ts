import { NextRequest } from 'next/server';
import { getServiceSupabase } from './supabaseServer';

export async function verifyStaffAuth(req: NextRequest): Promise<{ authorized: boolean; email?: string; error?: string }> {
  const authHeader = req.headers.get('authorization') || '';
  const staffApiKey = req.headers.get('x-staff-token') || req.headers.get('x-staff-key') || '';

  // 1. Check direct Staff API Secret (e.g. for extension or server-to-server)
  const configuredSecret = process.env.STAFF_API_SECRET;
  if (configuredSecret && staffApiKey === configuredSecret) {
    return { authorized: true, email: 'extension-staff@agency.internal' };
  }

  // 2. Check Supabase Auth Bearer JWT token
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

  if (!token) {
    return { authorized: false, error: 'Missing authorization bearer token or staff key' };
  }

  const supabase = getServiceSupabase();

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user || !user.email) {
      return { authorized: false, error: 'Invalid or expired auth session' };
    }

    const userEmail = user.email.toLowerCase().trim();

    // Check allow-listed staff emails from environment
    const envAllowed = (process.env.ALLOWED_STAFF_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (envAllowed.length > 0 && envAllowed.includes(userEmail)) {
      return { authorized: true, email: userEmail };
    }

    // Check staff_users table in database
    const { data: staffRow } = await supabase
      .from('staff_users')
      .select('email')
      .eq('email', userEmail)
      .maybeSingle();

    if (staffRow) {
      return { authorized: true, email: userEmail };
    }

    // If no allow-list is set up yet (initial dev mode), allow authenticated user with warning
    if (envAllowed.length === 0) {
      return { authorized: true, email: userEmail };
    }

    return { authorized: false, error: `Email ${userEmail} is not on the allow-listed staff list` };
  } catch (err: any) {
    return { authorized: false, error: err?.message || 'Authentication error' };
  }
}
