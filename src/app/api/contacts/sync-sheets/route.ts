import { getSheetData } from '@/lib/google-workspace';
import { createServerSupabaseClient } from '@/lib/supabase';

// Assumed column order in the Google Sheet "Contacts" tab:
// A=name, B=type, C=email, D=phone, E=address, F=city, G=country, H=is_active
// Row 1 is the header row; data starts at row 2.
// Adjust the column indices below if your sheet differs.

export async function POST() {
  const supabase = createServerSupabaseClient();

  let rows: string[][];
  try {
    rows = await getSheetData('Contacts!A:H');
  } catch (err) {
    await supabase.from('automation_logs').insert({
      event_type: 'sheet_sync_failed',
      details: { error: String(err) },
      status: 'error',
      error_message: String(err),
    });
    return Response.json({ error: `Google Sheets error: ${String(err)}` }, { status: 503 });
  }

  // Skip header row
  const dataRows = rows.slice(1);

  let synced = 0;
  let errors = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const name = row[0]?.trim();
    const email = row[2]?.trim();

    // Skip incomplete rows
    if (!name || !email) continue;

    const contact = {
      name,
      type: row[1]?.trim() || 'customer',
      email,
      phone: row[3]?.trim() || null,
      address: row[4]?.trim() || null,
      city: row[5]?.trim() || null,
      country: row[6]?.trim() || null,
      is_active: row[7]?.trim().toLowerCase() !== 'false',
      google_sheets_row_id: String(i + 2), // row 1 = header, row 2 = first data row
    };

    const { error } = await supabase
      .from('contacts')
      .upsert(contact, { onConflict: 'google_sheets_row_id' });

    if (error) {
      errors++;
    } else {
      synced++;
    }
  }

  await supabase.from('automation_logs').insert({
    event_type: 'sheet_synced',
    details: { rows_synced: synced, rows_failed: errors, source: 'Contacts' },
    status: errors === 0 ? 'success' : 'error',
  });

  return Response.json({ synced, errors });
}
