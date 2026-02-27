-- =============================================================
-- Fix RLS policies using a SECURITY DEFINER helper function.
--
-- The problem: RLS policies on restaurant_members reference
-- restaurant_members itself (self-referencing), and policies on
-- other tables use subqueries on restaurant_members which are
-- ALSO subject to RLS. This creates circular evaluation issues.
--
-- The fix: a SECURITY DEFINER function that runs with elevated
-- privileges, bypassing RLS to check membership.
-- =============================================================

-- Helper function: returns restaurant IDs the current user belongs to
CREATE OR REPLACE FUNCTION get_user_restaurant_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid();
$$;

-- Helper function: returns restaurant IDs where user is owner or manager
CREATE OR REPLACE FUNCTION get_user_managed_restaurant_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT restaurant_id FROM restaurant_members
  WHERE user_id = auth.uid() AND role IN ('owner', 'manager');
$$;

-- =============================================================
-- Drop ALL existing policies so we start clean
-- =============================================================

-- restaurants
DROP POLICY IF EXISTS "Members can view restaurant" ON restaurants;
DROP POLICY IF EXISTS "Owners can update restaurant" ON restaurants;
DROP POLICY IF EXISTS "Managers and owners can update restaurant" ON restaurants;
DROP POLICY IF EXISTS "Authenticated users can create restaurants" ON restaurants;

-- restaurant_members
DROP POLICY IF EXISTS "Members can view members" ON restaurant_members;
DROP POLICY IF EXISTS "Owners can insert members" ON restaurant_members;
DROP POLICY IF EXISTS "Users can create their own membership" ON restaurant_members;
DROP POLICY IF EXISTS "Owners can delete members" ON restaurant_members;

-- menu_categories
DROP POLICY IF EXISTS "Members can view menu categories" ON menu_categories;
DROP POLICY IF EXISTS "Members can manage menu categories" ON menu_categories;
DROP POLICY IF EXISTS "Members can insert menu categories" ON menu_categories;
DROP POLICY IF EXISTS "Members can delete menu categories" ON menu_categories;
DROP POLICY IF EXISTS "Members can update menu categories" ON menu_categories;

-- menu_items
DROP POLICY IF EXISTS "Members can view menu items" ON menu_items;
DROP POLICY IF EXISTS "Members can manage menu items" ON menu_items;
DROP POLICY IF EXISTS "Members can insert menu items" ON menu_items;
DROP POLICY IF EXISTS "Members can delete menu items" ON menu_items;
DROP POLICY IF EXISTS "Members can update menu items" ON menu_items;

-- modifier_groups
DROP POLICY IF EXISTS "Members can view modifier groups" ON modifier_groups;
DROP POLICY IF EXISTS "Members can manage modifier groups" ON modifier_groups;
DROP POLICY IF EXISTS "Members can insert modifier groups" ON modifier_groups;
DROP POLICY IF EXISTS "Members can delete modifier groups" ON modifier_groups;
DROP POLICY IF EXISTS "Members can update modifier groups" ON modifier_groups;

-- modifier_options
DROP POLICY IF EXISTS "Members can view modifier options" ON modifier_options;
DROP POLICY IF EXISTS "Members can insert modifier options" ON modifier_options;
DROP POLICY IF EXISTS "Members can delete modifier options" ON modifier_options;
DROP POLICY IF EXISTS "Members can update modifier options" ON modifier_options;

-- orders
DROP POLICY IF EXISTS "Members can view orders" ON orders;
DROP POLICY IF EXISTS "Members can update orders" ON orders;
DROP POLICY IF EXISTS "Members can insert orders" ON orders;

-- order_items
DROP POLICY IF EXISTS "Members can view order items" ON order_items;
DROP POLICY IF EXISTS "Members can insert order items" ON order_items;

-- calls
DROP POLICY IF EXISTS "Members can view calls" ON calls;
DROP POLICY IF EXISTS "Members can insert calls" ON calls;
DROP POLICY IF EXISTS "Members can update calls" ON calls;

-- customers
DROP POLICY IF EXISTS "Members can view customers" ON customers;
DROP POLICY IF EXISTS "Members can insert customers" ON customers;
DROP POLICY IF EXISTS "Members can update customers" ON customers;

-- =============================================================
-- Recreate ALL policies using the helper functions
-- =============================================================

-- RESTAURANTS
CREATE POLICY "restaurants_select" ON restaurants FOR SELECT
  USING (id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "restaurants_insert" ON restaurants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "restaurants_update" ON restaurants FOR UPDATE
  USING (id IN (SELECT get_user_managed_restaurant_ids()));

-- RESTAURANT_MEMBERS
CREATE POLICY "members_select" ON restaurant_members FOR SELECT
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "members_insert" ON restaurant_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR restaurant_id IN (SELECT get_user_managed_restaurant_ids())
  );

CREATE POLICY "members_delete" ON restaurant_members FOR DELETE
  USING (restaurant_id IN (SELECT get_user_managed_restaurant_ids()));

-- MENU_CATEGORIES
CREATE POLICY "menu_categories_select" ON menu_categories FOR SELECT
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "menu_categories_insert" ON menu_categories FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "menu_categories_update" ON menu_categories FOR UPDATE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "menu_categories_delete" ON menu_categories FOR DELETE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

-- MENU_ITEMS
CREATE POLICY "menu_items_select" ON menu_items FOR SELECT
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "menu_items_insert" ON menu_items FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "menu_items_update" ON menu_items FOR UPDATE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "menu_items_delete" ON menu_items FOR DELETE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

-- MODIFIER_GROUPS
CREATE POLICY "modifier_groups_select" ON modifier_groups FOR SELECT
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "modifier_groups_insert" ON modifier_groups FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "modifier_groups_update" ON modifier_groups FOR UPDATE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "modifier_groups_delete" ON modifier_groups FOR DELETE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

-- MODIFIER_OPTIONS (no restaurant_id, join through modifier_groups)
CREATE POLICY "modifier_options_select" ON modifier_options FOR SELECT
  USING (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (SELECT get_user_restaurant_ids())
  ));

CREATE POLICY "modifier_options_insert" ON modifier_options FOR INSERT
  WITH CHECK (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (SELECT get_user_restaurant_ids())
  ));

CREATE POLICY "modifier_options_update" ON modifier_options FOR UPDATE
  USING (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (SELECT get_user_restaurant_ids())
  ));

CREATE POLICY "modifier_options_delete" ON modifier_options FOR DELETE
  USING (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (SELECT get_user_restaurant_ids())
  ));

-- ORDERS
CREATE POLICY "orders_select" ON orders FOR SELECT
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "orders_insert" ON orders FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "orders_update" ON orders FOR UPDATE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

-- ORDER_ITEMS
CREATE POLICY "order_items_select" ON order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM orders WHERE restaurant_id IN (SELECT get_user_restaurant_ids())
  ));

CREATE POLICY "order_items_insert" ON order_items FOR INSERT
  WITH CHECK (order_id IN (
    SELECT id FROM orders WHERE restaurant_id IN (SELECT get_user_restaurant_ids())
  ));

-- CALLS
CREATE POLICY "calls_select" ON calls FOR SELECT
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "calls_insert" ON calls FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "calls_update" ON calls FOR UPDATE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

-- CUSTOMERS
CREATE POLICY "customers_select" ON customers FOR SELECT
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "customers_insert" ON customers FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT get_user_restaurant_ids()));

CREATE POLICY "customers_update" ON customers FOR UPDATE
  USING (restaurant_id IN (SELECT get_user_restaurant_ids()));
