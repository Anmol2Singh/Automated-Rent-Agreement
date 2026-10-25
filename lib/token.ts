import { getServiceSupabase } from './supabaseServer';

export async function generateTokenNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PNE-${currentYear}`;
  const supabase = getServiceSupabase();

  // 1. Try atomic Postgres RPC sequence function
  try {
    const { data, error } = await supabase.rpc('generate_next_token', { p_year: currentYear });
    if (!error && data && typeof data === 'string' && data.startsWith(prefix)) {
      return data;
    }
    if (error) {
      console.warn('Postgres RPC generate_next_token notice:', error.message);
    }
  } catch (rpcErr) {
    console.warn('RPC call failed, falling back to database query:', rpcErr);
  }

  // 2. Fallback: Query agreements table for highest token of current year
  try {
    const { data, error } = await supabase
      .from('agreements')
      .select('token_number')
      .like('token_number', `${prefix}-%`)
      .order('token_number', { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (!error && data && data.length > 0) {
      const lastToken = data[0].token_number;
      const parts = lastToken.split('-');
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
          nextNumber = parsed + 1;
        }
      }
    }
    return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
  } catch (err) {
    console.warn('Using safe fallback token generator:', err);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  }
}
