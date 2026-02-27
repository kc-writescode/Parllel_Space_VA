"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatTimeAgo, formatPhone } from "@/lib/utils/formatters";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/utils/constants";
import {
  Phone,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Clock,
  AlertCircle,
} from "lucide-react";

export default function DashboardHome() {
  const { restaurant, loading: restaurantLoading } = useRestaurant();
  const supabase = createClient();
  const router = useRouter();

  const [stats, setStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    todayCalls: 0,
    pendingOrders: 0,
    avgOrderValue: 0,
    conversionRate: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!restaurant) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [ordersResult, callsResult, recentOrdersResult, recentCallsResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("total, status")
          .eq("restaurant_id", restaurant.id)
          .gte("created_at", todayISO),
        supabase
          .from("calls")
          .select("id")
          .eq("restaurant_id", restaurant.id)
          .gte("created_at", todayISO),
        supabase
          .from("orders")
          .select("*, order_items(*), customer:customers(*)")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("calls")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const todayOrdersData = (ordersResult.data || []).filter(
      (o: any) => o.status !== "cancelled"
    );
    const todayRevenue = todayOrdersData.reduce(
      (sum: number, o: any) => sum + (o.total || 0),
      0
    );
    const todayCalls = callsResult.data?.length || 0;
    const pendingOrders = (ordersResult.data || []).filter(
      (o: any) => o.status === "pending"
    ).length;

    setStats({
      todayOrders: todayOrdersData.length,
      todayRevenue,
      todayCalls,
      pendingOrders,
      avgOrderValue:
        todayOrdersData.length > 0
          ? todayRevenue / todayOrdersData.length
          : 0,
      conversionRate:
        todayCalls > 0
          ? (todayOrdersData.length / todayCalls) * 100
          : 0,
    });

    setRecentOrders(recentOrdersResult.data || []);
    setRecentCalls(recentCallsResult.data || []);
  }, [restaurant, supabase]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Redirect to onboarding if:
  //  - no restaurant found (creation failed or metadata missing), OR
  //  - restaurant exists but onboarding isn't complete yet
  useEffect(() => {
    if (!restaurantLoading && (!restaurant || !restaurant.onboarding_completed)) {
      router.replace("/onboarding");
    }
  }, [restaurantLoading, restaurant, router]);

  // Realtime subscription for live updates
  useEffect(() => {
    if (!restaurant) return;

    const channel = supabase
      .channel("dashboard-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant, supabase, fetchDashboardData]);

  // Only block on restaurantLoading. The stats `loading` state must NOT gate
  // this check — if restaurant is null, fetchDashboardData returns early and
  // never sets loading=false, causing an infinite spinner.
  if (restaurantLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading dashboard...</p>
      </div>
    );
  }

  if (!restaurant || !restaurant.onboarding_completed) {
    // Redirect handled by the useEffect above; show a brief placeholder
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Setting up your account...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">Today&apos;s overview for {restaurant.name}</p>
        </div>
        {restaurant.retell_phone_number && (
          <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
            <Phone className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">
              {formatPhone(restaurant.retell_phone_number)}
            </span>
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs">
              Live
            </Badge>
          </div>
        )}
      </div>

      {/* Pending Alert */}
      {stats.pendingOrders > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">
              {stats.pendingOrders} order{stats.pendingOrders > 1 ? "s" : ""} waiting
              to be confirmed
            </span>
          </div>
          <Link href="/orders">
            <Button size="sm" variant="outline">
              View Orders
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Today's Revenue"
          value={formatCurrency(stats.todayRevenue)}
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          bgColor="bg-green-50"
        />
        <KPICard
          title="Today's Orders"
          value={stats.todayOrders.toString()}
          icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
          bgColor="bg-blue-50"
        />
        <KPICard
          title="Calls Today"
          value={stats.todayCalls.toString()}
          subtitle={`${stats.conversionRate.toFixed(0)}% conversion`}
          icon={<Phone className="h-5 w-5 text-purple-600" />}
          bgColor="bg-purple-50"
        />
        <KPICard
          title="Avg Order Value"
          value={formatCurrency(stats.avgOrderValue)}
          icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
          bgColor="bg-orange-50"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Orders</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No orders yet. They&apos;ll appear here when customers call.
              </p>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order: any) => (
                  <Link
                    href={`/orders/${order.id}`}
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">
                        #{order.order_number}
                      </span>
                      <div>
                        <p className="text-sm font-medium">
                          {order.customer?.name || "Unknown"}{" "}
                          <span className="text-gray-400 font-normal">
                            &middot; {order.order_type}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.order_items?.length || 0} items &middot;{" "}
                          {formatTimeAgo(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(order.total)}
                      </p>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${ORDER_STATUS_COLORS[order.status] || ""}`}
                      >
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Calls */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Calls</CardTitle>
            <Link href="/calls">
              <Button variant="ghost" size="sm">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentCalls.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                No calls yet. Share your AI phone number to start receiving orders.
              </p>
            ) : (
              <div className="space-y-3">
                {recentCalls.map((call: any) => (
                  <Link
                    href={`/calls/${call.id}`}
                    key={call.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          call.status === "completed"
                            ? "bg-green-100"
                            : call.status === "in_progress"
                            ? "bg-blue-100"
                            : "bg-gray-100"
                        }`}
                      >
                        <Phone
                          className={`h-4 w-4 ${
                            call.status === "completed"
                              ? "text-green-600"
                              : call.status === "in_progress"
                              ? "text-blue-600 animate-pulse"
                              : "text-gray-400"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {call.caller_phone
                            ? formatPhone(call.caller_phone)
                            : "Unknown caller"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTimeAgo(call.created_at)}
                          {call.duration_ms &&
                            ` · ${Math.ceil(call.duration_ms / 1000)}s`}
                        </p>
                      </div>
                    </div>
                    <div>
                      {call.order_id ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-700 text-xs"
                        >
                          Order placed
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No order
                        </Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/menu">
              <Button variant="outline">Edit Menu</Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline">
                <Clock className="h-4 w-4 mr-2" /> Business Hours
              </Button>
            </Link>
            <Link href="/kitchen" target="_blank">
              <Button variant="outline">Open Kitchen Display</Button>
            </Link>
            <Link href="/analytics">
              <Button variant="outline">View Analytics</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  bgColor,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-full ${bgColor}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
