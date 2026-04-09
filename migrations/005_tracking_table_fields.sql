ALTER TABLE shipments ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS product text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS loading_status text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS loading_date date;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS eta_override date;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS update_note text;
