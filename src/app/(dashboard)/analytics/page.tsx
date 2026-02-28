"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils/formatters";
import { eachDayOfInterval, format, subDays, startOfDay } from "date-fns";
import { Phone, ShoppingCart, DollarSign, TrendingUp, Clock, Utensils, Users } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

export default function AnalyticsPage() {
  const { restaurant } = useRestaurant();
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  const fetchData = useCallback(async () => {
    if (!restaurant) return;

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(period));
    const since = daysAgo.toISOString();

    const [orderResult, callResult, itemsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", since),
      supabase
        .from("calls")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .gte("created_at", since),
      supabase
        .from("order_items")
        .select("*, order:orders!inner(restaurant_id, created_at, status)")
        .eq("order.restaurant_id", restaurant.id)
        .gte("order.created_at", since),
    ]);

    setOrders(orderResult.data || []);
    setCalls(callResult.data || []);
    setOrderItems(itemsResult.data || []);
    setLoading(false);
  }, [restaurant, supabase, period]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const validOrders = orders.filter((o) => o.status !== "cancelled");
  const totalRevenue = validOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders = validOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalCalls = calls.length;
  const conversionRate = totalCalls > 0 ? (totalOrders / totalCalls) * 100 : 0;

  // Trend data for selected period
  const today = startOfDay(new Date());
  const periodStart = subDays(today, parseInt(period) - 1);
  const allDays = eachDayOfInterval({ start: periodStart, end: today });
  const trendData = allDays.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayOrders = validOrders.filter((o) => o.created_at.startsWith(dayStr));
    return {
      date: format(day, parseInt(period) <= 7 ? "EEE" : "MMM d"),
      revenue: dayOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
      orders: dayOrders.length,
    };
  });

  // Top selling items
  const itemCounts: Record<string, { name: string; count: number; revenue: number }> = {};
  orderItems
    .filter((item: any) => item.order?.status !== "cancelled")
    .forEach((item: any) => {
      const key = item.name;
      if (!itemCounts[key]) itemCounts[key] = { name: key, count: 0, revenue: 0 };
      itemCounts[key].count += item.quantity;
      itemCounts[key].revenue += item.item_total;
    });

  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 10);
  const maxItemCount = topItems[0]?.count || 1;

  // Orders by hour (peak hours)
  const hourCounts = new Array(24).fill(0);
  validOrders.forEach((o) => { hourCounts[new Date(o.created_at).getHours()]++; });
  const maxHourCount = Math.max(...hourCounts, 1);

  // Order type split
  const pickupCount = validOrders.filter((o) => o.order_type === "pickup").length;
  const deliveryCount = validOrders.filter((o) => o.order_type === "delivery").length;
  const pieData = [
    { name: "Pickup", value: pickupCount },
    { name: "Delivery", value: deliveryCount },
  ].filter((d) => d.value > 0);

  // Avg call duration
  const completedCalls = calls.filter((c: any) => c.duration_ms && c.duration_ms > 0);
  const avgCallDuration =
    completedCalls.length > 0
      ? completedCalls.reduce((sum: number, c: any) => sum + c.duration_ms, 0) / completedCalls.length
      : 0;

  // Repeat customers
  const customerOrderCounts: Record<string, number> = {};
  validOrders.forEach((o) => {
    if (o.customer_id) customerOrderCounts[o.customer_id] = (customerOrderCounts[o.customer_id] || 0) + 1;
  });
  const uniqueCustomers = Object.keys(customerOrderCounts).length;
  const repeatCustomers = Object.values(customerOrderCounts).filter((c) => c > 1).length;
  const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="7">7 Days</TabsTrigger>
            <TabsTrigger value="30">30 Days</TabsTrigger>
            <TabsTrigger value="90">90 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Revenue" value={formatCurrency(totalRevenue)}
          icon={<DollarSign className="h-5 w-5 text-green-600" />} bgColor="bg-green-50" />
        <KPICard title="Total Orders" value={totalOrders.toString()}
          subtitle={`${pickupCount} pickup · ${deliveryCount} delivery`}
          icon={<ShoppingCart className="h-5 w-5 text-blue-600" />} bgColor="bg-blue-50" />
        <KPICard title="Avg Order Value" value={formatCurrency(avgOrderValue)}
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />} bgColor="bg-purple-50" />
        <KPICard title="Call Conversion" value={`${conversionRate.toFixed(1)}%`}
          subtitle={`${totalCalls} calls → ${totalOrders} orders`}
          icon={<Phone className="h-5 w-5 text-orange-600" />} bgColor="bg-orange-50" />
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-full"><Clock className="h-4 w-4 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Avg Call Duration</p>
              <p className="text-lg font-bold">
                {avgCallDuration > 0
                  ? `${Math.floor(avgCallDuration / 60000)}m ${Math.floor((avgCallDuration % 60000) / 1000)}s`
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-full"><DollarSign className="h-4 w-4 text-green-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Revenue per Call</p>
              <p className="text-lg font-bold">{totalCalls > 0 ? formatCurrency(totalRevenue / totalCalls) : "N/A"}</p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-full"><Utensils className="h-4 w-4 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Avg Items / Order</p>
              <p className="text-lg font-bold">
                {totalOrders > 0
                  ? (orderItems.filter((i: any) => i.order?.status !== "cancelled").length / totalOrders).toFixed(1)
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-50 rounded-full"><Users className="h-4 w-4 text-pink-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Repeat Customers</p>
              <p className="text-lg font-bold">{uniqueCustomers > 0 ? `${repeatRate.toFixed(0)}%` : "N/A"}</p>
              {uniqueCustomers > 0 && <p className="text-xs text-gray-400">{repeatCustomers} of {uniqueCustomers}</p>}
            </div>
          </div>
        </CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader><CardTitle className="text-base">Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#revenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Orders Trend */}
        <Card>
          <CardHeader><CardTitle className="text-base">Orders Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip formatter={(v) => [v, "Orders"]} />
                <Bar dataKey="orders" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Peak Hours */}
        <Card>
          <CardHeader><CardTitle className="text-base">Peak Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-0.5 h-32">
              {hourCounts.map((count, hour) => (
                <div key={hour} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={`w-full rounded-t transition-all ${count > 0 ? "bg-purple-400" : "bg-gray-100"}`}
                    style={{ height: `${(count / maxHourCount) * 100}%`, minHeight: count > 0 ? 2 : 1 }}
                  />
                  {hour % 4 === 0 && (
                    <span className="text-[10px] text-gray-400">
                      {hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Type Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Order Type Breakdown</CardTitle></CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                    paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}>
                    <Cell fill="#3b82f6" />
                    <Cell fill="#22c55e" />
                  </Pie>
                  <Tooltip formatter={(v, name) => [v, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-400 text-center py-12">No order data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Selling Items */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top Selling Items</CardTitle></CardHeader>
        <CardContent>
          {topItems.length > 0 ? (
            <div className="space-y-3">
              {topItems.map((item, i) => (
                <div key={item.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs text-gray-500">{item.count} sold · {formatCurrency(item.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full"
                        style={{ width: `${(item.count / maxItemCount) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No order data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, bgColor }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-full ${bgColor}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
