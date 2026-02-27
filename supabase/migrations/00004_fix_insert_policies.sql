-- =============================================================
-- Ensure INSERT policies exist for restaurants and restaurant_members.
-- Safe to run even if policies already exist.
-- =============================================================

-- Restaurants: any authenticated user can create a restaurant
DROP POLICY IF EXISTS "restaurants_insert" ON restaurants;
CREATE POLICY "restaurants_insert" ON restaurants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Restaurant members: user can add themselves, or an owner/manager can add others
DROP POLICY IF EXISTS "members_insert" ON restaurant_members;
CREATE POLICY "members_insert" ON restaurant_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR restaurant_id IN (SELECT get_user_managed_restaurant_ids())
  );
