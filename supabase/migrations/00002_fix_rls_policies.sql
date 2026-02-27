-- =============================================================
-- FIX: Allow authenticated users to create restaurants (signup)
-- =============================================================
CREATE POLICY "Authenticated users can create restaurants" ON restaurants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================
-- FIX: Allow users to create their own first membership (signup)
-- The existing policy only allows owners to insert, but during signup
-- the user has no existing membership yet.
-- =============================================================
CREATE POLICY "Users can create their own membership" ON restaurant_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- =============================================================
-- FIX: Allow owners to delete members
-- =============================================================
CREATE POLICY "Owners can delete members" ON restaurant_members FOR DELETE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid() AND role = 'owner'
  ));

-- =============================================================
-- FIX: Allow managers and owners to update restaurant (not just owners)
-- =============================================================
DROP POLICY IF EXISTS "Owners can update restaurant" ON restaurants;
CREATE POLICY "Managers and owners can update restaurant" ON restaurants FOR UPDATE
  USING (id IN (
    SELECT restaurant_id FROM restaurant_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
  ));

-- =============================================================
-- FIX: Allow members to insert orders (for status updates via dashboard)
-- =============================================================
CREATE POLICY "Members can insert orders" ON orders FOR INSERT
  WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

-- =============================================================
-- FIX: Menu items need INSERT policies for adding items from dashboard
-- =============================================================
CREATE POLICY "Members can insert menu categories" ON menu_categories FOR INSERT
  WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete menu categories" ON menu_categories FOR DELETE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update menu categories" ON menu_categories FOR UPDATE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can insert menu items" ON menu_items FOR INSERT
  WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete menu items" ON menu_items FOR DELETE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update menu items" ON menu_items FOR UPDATE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

-- Modifier groups INSERT
CREATE POLICY "Members can insert modifier groups" ON modifier_groups FOR INSERT
  WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can delete modifier groups" ON modifier_groups FOR DELETE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update modifier groups" ON modifier_groups FOR UPDATE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

-- Modifier options INSERT/DELETE
CREATE POLICY "Members can insert modifier options" ON modifier_options FOR INSERT
  WITH CHECK (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (
      SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Members can delete modifier options" ON modifier_options FOR DELETE
  USING (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (
      SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Members can update modifier options" ON modifier_options FOR UPDATE
  USING (modifier_group_id IN (
    SELECT id FROM modifier_groups WHERE restaurant_id IN (
      SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
    )
  ));

-- =============================================================
-- FIX: Customers need INSERT/UPDATE policies
-- =============================================================
CREATE POLICY "Members can insert customers" ON customers FOR INSERT
  WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update customers" ON customers FOR UPDATE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

-- =============================================================
-- FIX: Order items need INSERT policy
-- =============================================================
CREATE POLICY "Members can insert order items" ON order_items FOR INSERT
  WITH CHECK (order_id IN (
    SELECT id FROM orders WHERE restaurant_id IN (
      SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
    )
  ));

-- =============================================================
-- FIX: Calls need INSERT/UPDATE policies
-- =============================================================
CREATE POLICY "Members can insert calls" ON calls FOR INSERT
  WITH CHECK (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update calls" ON calls FOR UPDATE
  USING (restaurant_id IN (
    SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()
  ));
