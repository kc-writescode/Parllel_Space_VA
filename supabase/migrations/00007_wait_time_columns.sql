-- Add configurable wait time columns to restaurants
ALTER TABLE restaurants
  ADD COLUMN pickup_wait_minutes  INTEGER DEFAULT 15,
  ADD COLUMN delivery_wait_minutes INTEGER DEFAULT 35;
