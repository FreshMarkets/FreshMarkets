ALTER TABLE shipments ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS product text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS loading_status text;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS company text;
