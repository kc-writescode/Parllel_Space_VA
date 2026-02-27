import { z } from "zod";

// ── Restaurant ──
export const restaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required"),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  address: z.string().optional(),
  phone: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal("")),
  timezone: z.string().default("America/New_York"),
  business_hours: z.record(z.string(), z.any()).default({}),
  delivery_enabled: z.boolean().default(false),
  delivery_radius_miles: z.number().positive().optional(),
  delivery_fee: z.number().min(0).default(0),
  tax_rate: z.number().min(0).max(1).default(0),
});

// ── Menu Category ──
export const menuCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
  sort_order: z.number().int().default(0),
  is_available: z.boolean().default(true),
});

// ── Menu Item ──
export const menuItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  base_price: z.number().positive("Price must be positive"),
  category_id: z.string().uuid(),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  image_url: z.string().url().optional().or(z.literal("")),
});

// ── Modifier Group ──
export const modifierGroupSchema = z.object({
  name: z.string().min(1, "Modifier group name is required"),
  menu_item_id: z.string().uuid(),
  required: z.boolean().default(false),
  min_selections: z.number().int().min(0).default(0),
  max_selections: z.number().int().min(1).default(1),
  sort_order: z.number().int().default(0),
});

// ── Modifier Option ──
export const modifierOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  modifier_group_id: z.string().uuid(),
  price_adjustment: z.number().default(0),
  is_default: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});

// ── Order (from voice agent) ──
export const orderItemInput = z.object({
  item_name: z.string(),
  quantity: z.number().int().positive(),
  modifiers: z
    .array(
      z.object({
        group: z.string(),
        option: z.string(),
        price: z.number().optional(),
      })
    )
    .default([]),
  special_instructions: z.string().optional(),
});

export const createOrderSchema = z.object({
  restaurant_id: z.string().uuid(),
  order_type: z.enum(["pickup", "delivery"]),
  items: z.array(orderItemInput).min(1, "Order must have at least one item"),
  customer_phone: z.string().min(10),
  customer_name: z.string().optional(),
  delivery_address: z.string().optional(),
  delivery_notes: z.string().optional(),
});

// ── Menu Scrape ──
export const scrapeMenuSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
});

export type RestaurantInput = z.infer<typeof restaurantSchema>;
export type MenuCategoryInput = z.infer<typeof menuCategorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type ModifierGroupInput = z.infer<typeof modifierGroupSchema>;
export type ModifierOptionInput = z.infer<typeof modifierOptionSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
