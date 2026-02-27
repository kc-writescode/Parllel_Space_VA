-- =============================================================
-- EXTENSIONS
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- ENUMS
-- =============================================================
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'staff');
CREATE TYPE order_type AS ENUM ('pickup', 'delivery');
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled'
);
CREATE TYPE payment_status AS ENUM ('unpaid', 'link_sent', 'paid', 'refunded');
CREATE TYPE call_status AS ENUM ('in_progress', 'completed', 'error', 'voicemail');

-- =============================================================
-- RESTAURANTS
-- =============================================================
CREATE TABLE restaurants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  address         TEXT,
  phone           TEXT,
  website_url     TEXT,
  timezone        TEXT DEFAULT 'America/New_York',
  business_hours  JSONB DEFAULT '{}',
  delivery_enabled BOOLEAN DEFAULT false,
  delivery_radius_miles NUMERIC(5,2),
  delivery_fee    NUMERIC(8,2) DEFAULT 0,
  tax_rate        NUMERIC(5,4) DEFAULT 0,
  retell_agent_id TEXT,
  retell_llm_id   TEXT,
  retell_phone_number TEXT,
  retell_phone_number_id TEXT,
  stripe_account_id TEXT,
  is_active       BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- RESTAURANT MEMBERS
-- =============================================================
CREATE TABLE restaurant_members (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            user_role NOT NULL DEFAULT 'staff',
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

-- =============================================================
-- MENU CATEGORIES
-- =============================================================
CREATE TABLE menu_categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  sort_order      INTEGER DEFAULT 0,
  is_available    BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- MENU ITEMS
-- =============================================================
CREATE TABLE menu_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id     UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  base_price      NUMERIC(8,2) NOT NULL,
  is_available    BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  image_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- MODIFIER GROUPS
-- =============================================================
CREATE TABLE modifier_groups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id    UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  required        BOOLEAN DEFAULT false,
  min_selections  INTEGER DEFAULT 0,
  max_selections  INTEGER DEFAULT 1,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- MODIFIER OPTIONS
-- =============================================================
CREATE TABLE modifier_options (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  price_adjustment NUMERIC(8,2) DEFAULT 0,
  is_default      BOOLEAN DEFAULT false,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- CUSTOMERS
-- =============================================================
CREATE TABLE customers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone           TEXT NOT NULL,
  name            TEXT,
  email           TEXT,
  default_address TEXT,
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(phone, restaurant_id)
);

-- =============================================================
-- ORDERS
-- =============================================================
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id),
  order_number    SERIAL,
  order_type      order_type NOT NULL,
  status          order_status NOT NULL DEFAULT 'pending',
  payment_status  payment_status NOT NULL DEFAULT 'unpaid',
  delivery_address TEXT,
  delivery_notes  TEXT,
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax             NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  stripe_payment_link_id TEXT,
  stripe_payment_link_url TEXT,
  stripe_payment_intent_id TEXT,
  paid_at         TIMESTAMPTZ,
  estimated_ready_at TIMESTAMPTZ,
  confirmed_at    TIMESTAMPTZ,
  ready_at        TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- ORDER ITEMS
-- =============================================================
CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    UUID REFERENCES menu_items(id),
  name            TEXT NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(8,2) NOT NULL,
  modifiers       JSONB DEFAULT '[]',
  item_total      NUMERIC(8,2) NOT NULL,
  special_instructions TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- =============================================================
-- CALLS
-- =============================================================
CREATE TABLE calls (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  retell_call_id  TEXT UNIQUE NOT NULL,
  customer_id     UUID REFERENCES customers(id),
  order_id        UUID REFERENCES orders(id),
  caller_phone    TEXT,
  status          call_status NOT NULL DEFAULT 'in_progress',
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_ms     INTEGER,
  transcript      JSONB,
  call_analysis   JSONB,
  recording_url   TEXT,
  disconnection_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Add FK from orders to calls
ALTER TABLE orders ADD COLUMN call_id UUID REFERENCES calls(id);

-- =============================================================
-- INDEXES
-- =============================================================
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status);
CREATE INDEX idx_orders_restaurant_created ON orders(restaurant_id, created_at DESC);
CREATE INDEX idx_calls_restaurant ON calls(restaurant_id);
CREATE INDEX idx_calls_retell_id ON calls(retell_call_id);
CREATE INDEX idx_customers_phone_restaurant ON customers(phone, restaurant_id);
CREATE INDEX idx_restaurant_members_user ON restaurant_members(user_id);
CREATE INDEX idx_restaurant_retell_phone ON restaurants(retell_phone_number);

-- =============================================================
-- UPDATED_AT TRIGGER
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_restaurants_updated_at
  BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_menu_categories_updated_at
  BEFORE UPDATE ON menu_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Members can view their restaurant
CREATE POLICY "Members can view restaurant" ON restaurants FOR SELECT
  USING (id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- Owners can update their restaurant
CREATE POLICY "Owners can update restaurant" ON restaurants FOR UPDATE
  USING (id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Members can view their restaurant members
CREATE POLICY "Members can view members" ON restaurant_members FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- Owners can manage members
CREATE POLICY "Owners can insert members" ON restaurant_members FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid() AND role = 'owner'));

-- Menu policies
CREATE POLICY "Members can view menu categories" ON menu_categories FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can manage menu categories" ON menu_categories FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can view menu items" ON menu_items FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can manage menu items" ON menu_items FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can view modifier groups" ON modifier_groups FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can manage modifier groups" ON modifier_groups FOR ALL
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can view modifier options" ON modifier_options FOR SELECT
  USING (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (
      SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
    )
  ));

-- Order policies
CREATE POLICY "Members can view orders" ON orders FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Members can update orders" ON orders FOR UPDATE
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

CREATE POLICY "Members can view order items" ON order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE restaurant_id IN (
      SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
    )
  ));

-- Call policies
CREATE POLICY "Members can view calls" ON calls FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- Customer policies
CREATE POLICY "Members can view customers" ON customers FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- =============================================================
-- Enable realtime for orders table
-- =============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
