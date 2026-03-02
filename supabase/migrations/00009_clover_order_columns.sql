-- =============================================================
-- CLOVER ID MAPPING COLUMNS
-- =============================================================

-- Store Clover inventory item ID during menu sync
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS clover_item_id TEXT;

-- Store Clover modifier ID during menu sync
ALTER TABLE modifier_options
  ADD COLUMN IF NOT EXISTS clover_modifier_id TEXT;

-- Store Clover order ID after pushing order to Clover
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS clover_order_id TEXT;

-- Index for looking up menu items by Clover ID
CREATE INDEX IF NOT EXISTS idx_menu_items_clover_id
  ON menu_items(clover_item_id) WHERE clover_item_id IS NOT NULL;
