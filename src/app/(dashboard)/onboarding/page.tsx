"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { ScrapeForm } from "@/components/menu/scrape-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Loader2, Phone, Store, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/utils/constants";
import type { ExtractedMenu } from "@/lib/scraper/ai-extractor";

const STEPS = [
  { icon: Store, label: "Restaurant Info" },
  { icon: UtensilsCrossed, label: "Menu Setup" },
  { icon: Phone, label: "Go Live" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { restaurant, loading: restaurantLoading } = useRestaurant();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Fallback: no restaurant found (e.g. OAuth signup without restaurant_name metadata)
  const [newRestaurantName, setNewRestaurantName] = useState("");
  const [creatingRestaurant, setCreatingRestaurant] = useState(false);

  async function handleCreateRestaurant(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newRestaurantName.trim()) return;
    setCreatingRestaurant(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { toast.error("Not signed in"); return; }
      const slug =
        newRestaurantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") +
        "-" + Date.now().toString(36);
      const { data: newRestaurant, error: restaurantError } = await supabase.rpc(
        "create_restaurant_for_user",
        { p_name: newRestaurantName.trim(), p_slug: slug }
      );
      if (restaurantError || !newRestaurant) {
        console.error("Restaurant create error:", restaurantError);
        toast.error(restaurantError?.message || "Failed to create restaurant. Please try again.");
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("Create restaurant error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCreatingRestaurant(false);
    }
  }

  // Step 1: Restaurant Info
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("3.99");
  const [deliveryRadius, setDeliveryRadius] = useState("5");
  const [taxRate, setTaxRate] = useState("8.25");

  // Pre-populate form fields from saved restaurant data
  useEffect(() => {
    if (!restaurant) return;
    if (restaurant.address) setAddress(restaurant.address);
    if (restaurant.phone) setPhone(restaurant.phone);
    if (restaurant.website_url) setWebsiteUrl(restaurant.website_url);
    setDeliveryEnabled(restaurant.delivery_enabled ?? false);
    if (restaurant.delivery_fee) setDeliveryFee(String(restaurant.delivery_fee));
    if (restaurant.delivery_radius_miles) setDeliveryRadius(String(restaurant.delivery_radius_miles));
    if (restaurant.tax_rate) setTaxRate(String((restaurant.tax_rate * 100).toFixed(2)));
  }, [restaurant]);

  // Step 2: Menu
  const [menuImported, setMenuImported] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  // Step 3: Provisioning
  const [provisioning, setProvisioning] = useState(false);
  const [provisionedPhone, setProvisionedPhone] = useState("");
  const [isLive, setIsLive] = useState(false);

  async function saveRestaurantInfo() {
    if (!restaurant) {
      toast.error("Restaurant not loaded yet. Please wait...");
      return;
    }
    setSaving(true);

    try {
      const { error } = await supabase.rpc("update_restaurant_info", {
        p_restaurant_id: restaurant.id,
        p_address: address || null,
        p_phone: phone || null,
        p_website_url: websiteUrl || null,
        p_delivery_enabled: deliveryEnabled,
        p_delivery_fee: parseFloat(deliveryFee) || 0,
        p_delivery_radius_miles: parseFloat(deliveryRadius) || null,
        p_tax_rate: parseFloat(taxRate) / 100 || 0,
        p_business_hours: DEFAULT_BUSINESS_HOURS,
      });

      if (error) {
        toast.error(error.message || "Failed to save restaurant info");
        return;
      }

      toast.success("Restaurant info saved");
      setStep(1);
    } catch (err) {
      toast.error("Failed to save restaurant info");
    } finally {
      setSaving(false);
    }
  }

  async function handleMenuExtracted(menu: ExtractedMenu) {
    if (!restaurant) return;

    let totalItems = 0;

    for (const cat of menu.categories) {
      const { data: category } = await supabase
        .from("menu_categories")
        .insert({
          restaurant_id: restaurant.id,
          name: cat.name,
          sort_order: menu.categories.indexOf(cat),
        })
        .select("id")
        .single();

      if (!category) continue;

      for (const item of cat.items) {
        const { data: menuItem } = await supabase
          .from("menu_items")
          .insert({
            category_id: category.id,
            restaurant_id: restaurant.id,
            name: item.name,
            description: item.description,
            base_price: item.price,
            sort_order: cat.items.indexOf(item),
          })
          .select("id")
          .single();

        totalItems++;

        if (menuItem && item.modifiers) {
          for (const mod of item.modifiers) {
            const { data: group } = await supabase
              .from("modifier_groups")
              .insert({
                menu_item_id: menuItem.id,
                restaurant_id: restaurant.id,
                name: mod.group_name,
                required: mod.required,
              })
              .select("id")
              .single();

            if (group) {
              await supabase.from("modifier_options").insert(
                mod.options.map((o, i) => ({
                  modifier_group_id: group.id,
                  name: o.name,
                  price_adjustment: o.price_adjustment,
                  sort_order: i,
                }))
              );
            }
          }
        }
      }
    }

    setMenuImported(true);
    setImportedCount(totalItems);
    toast.success(`Imported ${totalItems} menu items`);
  }

  async function provisionAgent() {
    if (!restaurant) return;
    setProvisioning(true);

    try {
      // Fetch restaurant + menu via SECURITY DEFINER function (bypasses RLS)
      const { data: provisionData, error: fetchError } = await supabase.rpc(
        "get_restaurant_for_provisioning",
        { p_restaurant_id: restaurant.id }
      );

      if (fetchError || !provisionData) {
        throw new Error(fetchError?.message || "Failed to load restaurant data");
      }

      // Send restaurant + menu to the API route (which only calls Retell, no DB)
      const res = await fetch("/api/restaurants/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: provisionData.restaurant,
          menu: provisionData.menu || [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Provisioning failed");
      }

      // Save Retell credentials + mark onboarding complete via RPC
      const { error: saveError } = await supabase.rpc("complete_provisioning", {
        p_restaurant_id: restaurant.id,
        p_agent_id: data.agent_id,
        p_llm_id: data.llm_id,
        p_phone_number: data.phone_number,
        p_phone_number_id: data.phone_number_id,
      });

      if (saveError) throw new Error(saveError.message);

      setProvisionedPhone(data.phone_number);
      setIsLive(true);
      toast.success("Your AI agent is live!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to provision agent");
    } finally {
      setProvisioning(false);
    }
  }

  if (restaurantLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Create Your Restaurant</CardTitle>
            <p className="text-sm text-gray-500">Enter your restaurant name to get started.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateRestaurant} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant-name">Restaurant Name</Label>
                <Input
                  id="restaurant-name"
                  placeholder="e.g. Mario's Pizzeria"
                  value={newRestaurantName}
                  onChange={(e) => setNewRestaurantName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={creatingRestaurant}>
                {creatingRestaurant ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Set Up Your Restaurant</h1>
      <p className="text-gray-500 mb-8">Get your AI phone ordering agent up and running in 3 easy steps.</p>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full ${
                i < step
                  ? "bg-green-100 text-green-700"
                  : i === step
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < step ? <CheckCircle className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
            </div>
            <span
              className={`text-sm font-medium ${
                i <= step ? "text-gray-900" : "text-gray-400"
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < step ? "bg-green-300" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Restaurant Info */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Restaurant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                placeholder="123 Main St, New York, NY 10001"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  placeholder="https://yourrestaurant.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="max-w-32"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
              <Label>Enable Delivery</Label>
            </div>
            {deliveryEnabled && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label>Delivery Fee ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Delivery Radius (miles)</Label>
                  <Input
                    type="number"
                    value={deliveryRadius}
                    onChange={(e) => setDeliveryRadius(e.target.value)}
                  />
                </div>
              </div>
            )}
            <Button className="w-full mt-4" onClick={saveRestaurantInfo} disabled={saving}>
              {saving ? "Saving..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Menu Setup */}
      {step === 1 && (
        <div className="space-y-4">
          <ScrapeForm onMenuExtracted={handleMenuExtracted} />

          {menuImported && (
            <Card>
              <CardContent className="py-6 text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="font-medium">
                  {importedCount} menu items imported successfully!
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  You can edit these anytime from the Menu page.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              {menuImported ? "Continue" : "Skip for now"}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Go Live */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Launch Your AI Agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isLive ? (
              <>
                <p className="text-gray-600">
                  We&apos;ll provision a dedicated phone number for your restaurant.
                  Customers can call this number to place orders with your AI agent.
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={provisionAgent}
                  disabled={provisioning}
                >
                  {provisioning ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Setting up your agent...
                    </>
                  ) : (
                    <>
                      <Phone className="h-5 w-5 mr-2" />
                      Go Live
                    </>
                  )}
                </Button>
                {provisioning && (
                  <p className="text-sm text-gray-500 text-center">
                    This may take 15-30 seconds...
                  </p>
                )}
              </>
            ) : (
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold text-green-700">You&apos;re Live!</h2>
                <p className="text-gray-600">Your AI phone ordering agent is ready.</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Your ordering number</p>
                  <p className="text-3xl font-bold mt-1">{provisionedPhone}</p>
                </div>
                <Badge variant="outline" className="text-sm">
                  Share this number with your customers
                </Badge>
                <Button className="w-full" size="lg" onClick={() => router.push("/orders")}>
                  Go to Dashboard
                </Button>
              </div>
            )}

            {!isLive && (
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
