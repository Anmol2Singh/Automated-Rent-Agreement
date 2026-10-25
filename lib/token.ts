import { supabase } from './supabaseClient';

export async function generateTokenNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PNE-${currentYear}`;

  try {
    const { data, error } = await supabase
      .from('agreements')
      .select('token_number')
      .like('token_number', `${prefix}-%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextNumber = 1;

    if (!error && data && data.length > 0) {
      const lastToken = data[0].token_number;
      const parts = lastToken.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }
    } else {
      // Fallback timestamp randomizer for initial local state or empty table
      nextNumber = Math.floor(100 + Math.random() * 900);
    }

    const paddedNumber = String(nextNumber).padStart(4, '0');
    return `${prefix}-${paddedNumber}`;
  } catch (err) {
    console.warn("Using fallback token generator", err);
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  }
}
