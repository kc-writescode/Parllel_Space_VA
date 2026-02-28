"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { formatPhone } from "@/lib/utils/formatters";
import { toast } from "sonner";
import { Phone, Store, Truck, Users, Plus, Trash2, Mail, BarChart2, Activity, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { startOfMonth, subMonths, format } from "date-fns";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default function SettingsPage() {
  const { restaurant } = useRestaurant();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);

  const [usage, setUsage] = useState<{
    callsThisMonth: number;
    callsLastMonth: number;
    ordersThisMonth: number;
    ordersLastMonth: number;
  } | null>(null);
  const [auditLogs, setAuditLogs] = useState<Array<{
    id: string;
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    created_at: string;
  }>>([]);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryRadius, setDeliveryRadius] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [businessHours, setBusinessHours] = useState<
    Record<string, { open: string; close: string; closed?: boolean }>
  >({});
  const [pickupWait, setPickupWait] = useState("15");
  const [deliveryWait, setDeliveryWait] = useState("35");

  const fetchMembers = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("restaurant_members")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: true });
    setMembers(data || []);
  }, [restaurant, supabase]);

  const fetchUsage = useCallback(async () => {
    if (!restaurant) return;
    const now = new Date();
    const thisMonthStart = startOfMonth(now).toISOString();
    const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
    const [callsThis, callsLast, ordersThis, ordersLast] = await Promise.all([
      supabase.from("calls").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).gte("created_at", thisMonthStart),
      supabase.from("calls").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).gte("created_at", lastMonthStart).lt("created_at", thisMonthStart),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).gte("created_at", thisMonthStart),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("restaurant_id", restaurant.id).gte("created_at", lastMonthStart).lt("created_at", thisMonthStart),
    ]);
    setUsage({
      callsThisMonth: callsThis.count ?? 0,
      callsLastMonth: callsLast.count ?? 0,
      ordersThisMonth: ordersThis.count ?? 0,
      ordersLastMonth: ordersLast.count ?? 0,
    });
  }, [restaurant, supabase]);

  const fetchAuditLogs = useCallback(async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, created_at")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setAuditLogs(data || []);
  }, [restaurant, supabase]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setAddress(restaurant.address || "");
    setPhone(restaurant.phone || "");
    setWebsiteUrl(restaurant.website_url || "");
    setTimezone(restaurant.timezone);
    setDeliveryEnabled(restaurant.delivery_enabled);
    setDeliveryFee(restaurant.delivery_fee?.toString() || "");
    setDeliveryRadius(restaurant.delivery_radius_miles?.toString() || "");
    setTaxRate(((restaurant.tax_rate || 0) * 100).toFixed(2));
    setBusinessHours((restaurant.business_hours || {}) as Record<string, { open: string; close: string }>);
    setPickupWait((restaurant.pickup_wait_minutes ?? 15).toString());
    setDeliveryWait((restaurant.delivery_wait_minutes ?? 35).toString());
  }, [restaurant]);

  async function inviteMember() {
    if (!restaurant || !inviteEmail) return;
    setInviting(true);

    try {
      const res = await fetch("/api/restaurants/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurant.id,
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to invite member");
      } else {
        toast.success(`${inviteEmail} added as ${inviteRole}`);
        setInviteEmail("");
        fetchMembers();
      }
    } catch {
      toast.error("Failed to invite member");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from("restaurant_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      toast.error("Failed to remove member");
    } else {
      toast.success("Member removed");
      fetchMembers();
    }
  }

  async function handleSave() {
    if (!restaurant) return;
    setSaving(true);

    const { error } = await supabase
      .from("restaurants")
      .update({
        name,
        address,
        phone,
        website_url: websiteUrl || null,
        timezone,
        delivery_enabled: deliveryEnabled,
        delivery_fee: parseFloat(deliveryFee) || 0,
        delivery_radius_miles: parseFloat(deliveryRadius) || null,
        tax_rate: parseFloat(taxRate) / 100 || 0,
        business_hours: businessHours,
        pickup_wait_minutes: parseInt(pickupWait) || 15,
        delivery_wait_minutes: parseInt(deliveryWait) || 35,
      })
      .eq("id", restaurant.id);

    setSaving(false);

    if (error) {
      toast.error("Failed to save settings");
    } else {
      toast.success("Settings saved");
    }
  }

  function updateHours(day: string, field: "open" | "close", value: string) {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  if (!restaurant) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Phone Number */}
      {restaurant.retell_phone_number && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              AI Phone Number
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatPhone(restaurant.retell_phone_number)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Share this number with your customers. The AI agent will answer calls and take orders.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Restaurant Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            Restaurant Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Restaurant Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
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
        </CardContent>
      </Card>

      {/* Delivery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Delivery Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} />
            <Label>Enable Delivery</Label>
          </div>
          {deliveryEnabled && (
            <div className="grid grid-cols-2 gap-4">
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
        </CardContent>
      </Card>

      {/* Wait Time Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Wait Time Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Set the default wait times that the AI agent quotes to callers. These are base estimates.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pickup Wait (minutes)</Label>
              <Input
                type="number"
                min="5"
                max="120"
                value={pickupWait}
                onChange={(e) => setPickupWait(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                AI will quote {pickupWait}-{parseInt(pickupWait) + 5} min
              </p>
            </div>
            <div className="space-y-2">
              <Label>Delivery Wait (minutes)</Label>
              <Input
                type="number"
                min="10"
                max="180"
                value={deliveryWait}
                onChange={(e) => setDeliveryWait(e.target.value)}
              />
              <p className="text-xs text-gray-400">
                AI will quote {deliveryWait}-{parseInt(deliveryWait) + 10} min
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <CardTitle>Business Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {DAYS.map((day) => (
            <div key={day.key} className="flex items-center gap-4">
              <span className="w-24 text-sm font-medium">{day.label}</span>
              <Input
                type="time"
                value={businessHours[day.key]?.open || "09:00"}
                onChange={(e) => updateHours(day.key, "open", e.target.value)}
                className="w-32"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="time"
                value={businessHours[day.key]?.close || "22:00"}
                onChange={(e) => updateHours(day.key, "close", e.target.value)}
                className="w-32"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Team Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Members */}
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    <Users className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.user_id.slice(0, 8)}...</p>
                    <Badge variant="secondary" className="text-xs mt-0.5">
                      {member.role}
                    </Badge>
                  </div>
                </div>
                {member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(member.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No team members yet.</p>
            )}
          </div>

          <Separator />

          {/* Invite New Member */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Invite a team member</p>
            <div className="flex gap-2">
              <Input
                placeholder="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm"
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
              <Button
                onClick={inviteMember}
                disabled={inviting || !inviteEmail}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                {inviting ? "Inviting..." : "Invite"}
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              Team members can view orders and manage the kitchen display. Managers can also edit menu and settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage This Month */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5" />
              Usage This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Calls</p>
                <p className="text-3xl font-bold mt-1">{usage.callsThisMonth}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  {usage.callsThisMonth >= usage.callsLastMonth
                    ? <TrendingUp className="h-3 w-3 text-green-500" />
                    : <TrendingDown className="h-3 w-3 text-red-500" />}
                  {usage.callsLastMonth} last month
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-gray-500">Orders</p>
                <p className="text-3xl font-bold mt-1">{usage.ordersThisMonth}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  {usage.ordersThisMonth >= usage.ordersLastMonth
                    ? <TrendingUp className="h-3 w-3 text-green-500" />
                    : <TrendingDown className="h-3 w-3 text-red-500" />}
                  {usage.ordersLastMonth} last month
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No activity recorded yet.</p>
          ) : (
            <div className="divide-y">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {log.action.replace(/\./g, " · ").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    {log.entity_type && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {format(new Date(log.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Button onClick={handleSave} disabled={saving} size="lg">
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
