-- SECURITY DEFINER function to create restaurant + membership in one call.
-- Runs as the DB owner (bypasses RLS) but still validates auth.uid().
CREATE OR REPLACE FUNCTION create_restaurant_for_user(
  p_name TEXT,
  p_slug TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_restaurant_id UUID;
  v_restaurant json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user already has a restaurant (avoid duplicates)
  SELECT row_to_json(r) INTO v_restaurant
  FROM restaurants r
  JOIN restaurant_members rm ON rm.restaurant_id = r.id
  WHERE rm.user_id = v_user_id
  LIMIT 1;

  IF v_restaurant IS NOT NULL THEN
    RETURN v_restaurant;
  END IF;

  INSERT INTO restaurants (name, slug)
  VALUES (p_name, p_slug)
  RETURNING id INTO v_restaurant_id;

  INSERT INTO restaurant_members (restaurant_id, user_id, role)
  VALUES (v_restaurant_id, v_user_id, 'owner');

  SELECT row_to_json(r) INTO v_restaurant
  FROM restaurants r WHERE r.id = v_restaurant_id;

  RETURN v_restaurant;
END;
$$;

GRANT EXECUTE ON FUNCTION create_restaurant_for_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_restaurant_for_user(TEXT, TEXT) TO anon;
