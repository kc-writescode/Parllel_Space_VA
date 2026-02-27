"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/order-status-badge";
import { formatCurrency, formatPhone, formatTimeAgo } from "@/lib/utils/formatters";
import { toast } from "sonner";
import {
  ArrowLeft,
  MapPin,
  ShoppingBag,
  Phone,
  User,
  Clock,
  CreditCard,
  FileText,
  ExternalLink,
  Send,
  Link2,
} from "lucide-react";

const nextStatus: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "completed",
};

const actionLabels: Record<string, string> = {
  pending: "Confirm Order",
  confirmed: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Complete Order",
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { restaurant } = useRestaurant();
  const supabase = createClient();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    async function fetchOrder() {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*), customer:customers(*)")
        .eq("id", orderId)
        .single();

      setOrder(data);
      setLoading(false);
    }

    fetchOrder();

    // Realtime updates for this order
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => { fetchOrder(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, supabase]);

  async function updateStatus() {
    if (!order) return;
    const next = nextStatus[order.status];
    if (!next) return;

    const updateData: Record<string, unknown> = { status: next };
    if (next === "confirmed") updateData.confirmed_at = new Date().toISOString();
    if (next === "ready") updateData.ready_at = new Date().toISOString();
    if (next === "completed") updateData.completed_at = new Date().toISOString();

    await supabase.from("orders").update(updateData).eq("id", order.id);
  }

  async function cancelOrder() {
    if (!order) return;
    await supabase
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", order.id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500">Order not found.</p>
        <Link href="/orders">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const timeline = [
    { label: "Placed", time: order.created_at },
    { label: "Confirmed", time: order.confirmed_at },
    { label: "Ready", time: order.ready_at },
    { label: "Completed", time: order.completed_at },
    ...(order.cancelled_at ? [{ label: "Cancelled", time: order.cancelled_at }] : []),
  ].filter((t) => t.time);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Orders
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
              <Badge variant="outline" className="text-xs">
                {order.order_type === "delivery" ? (
                  <><MapPin className="h-3 w-3 mr-1" /> Delivery</>
                ) : (
                  <><ShoppingBag className="h-3 w-3 mr-1" /> Pickup</>
                )}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Placed {formatTimeAgo(order.created_at)} &middot;{" "}
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Order Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          {item.quantity}x
                        </span>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      {/* Modifiers */}
                      {item.modifiers && Object.keys(item.modifiers).length > 0 && (
                        <div className="ml-6 mt-1 space-y-0.5">
                          {Object.entries(item.modifiers).map(([group, selections]: [string, any]) => (
                            <p key={group} className="text-xs text-gray-500">
                              {group}: {Array.isArray(selections) ? selections.join(", ") : String(selections)}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.special_instructions && (
                        <p className="ml-6 mt-1 text-xs text-orange-600 italic">
                          Note: {item.special_instructions}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {formatCurrency(item.item_total)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span>{formatCurrency(order.tax)}</span>
                </div>
                {order.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Delivery Fee</span>
                    <span>{formatCurrency(order.delivery_fee)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(order.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timeline.map((event, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      i === timeline.length - 1 ? "bg-blue-500" : "bg-gray-300"
                    }`} />
                    <div className="flex-1">
                      <span className="text-sm font-medium">{event.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(event.time).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Customer, Actions, Payment */}
        <div className="space-y-6">
          {/* Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nextStatus[order.status] && (
                <Button className="w-full" onClick={updateStatus}>
                  {actionLabels[order.status]}
                </Button>
              )}
              {order.status === "pending" && (
                <Button variant="destructive" className="w-full" onClick={cancelOrder}>
                  Cancel Order
                </Button>
              )}
              {order.status === "completed" && (
                <p className="text-sm text-center text-gray-400">Order completed</p>
              )}
              {order.status === "cancelled" && (
                <p className="text-sm text-center text-red-400">Order was cancelled</p>
              )}
            </CardContent>
          </Card>

          {/* Customer Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.customer ? (
                <>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{order.customer.name || "No name"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{formatPhone(order.customer.phone)}</span>
                  </div>
                  {order.customer.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {order.customer.email}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400">No customer info</p>
              )}

              {order.delivery_address && (
                <>
                  <Separator />
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className="text-sm">{order.delivery_address}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <PaymentStatusBadge status={order.payment_status} />
              {order.stripe_payment_link_url && (
                <a
                  href={order.stripe_payment_link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Payment Link
                </a>
              )}
              {order.stripe_payment_intent_id && (
                <p className="text-xs text-gray-400 break-all">
                  Payment ID: {order.stripe_payment_intent_id}
                </p>
              )}
              {order.paid_at && (
                <p className="text-xs text-green-600">
                  Paid {new Date(order.paid_at).toLocaleString()}
                </p>
              )}

              {/* Payment Actions */}
              {order.payment_status !== "paid" && order.total > 0 && (
                <div className="pt-2 space-y-2 border-t">
                  {!order.stripe_payment_link_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/payments/create-link", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ order_id: order.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          toast.success("Payment link created");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to create payment link");
                        }
                      }}
                    >
                      <Link2 className="h-4 w-4 mr-1" /> Create Payment Link
                    </Button>
                  )}
                  {order.stripe_payment_link_url && order.customer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/payments/send-sms", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ order_id: order.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error);
                          toast.success("Payment SMS sent");
                        } catch (err: any) {
                          toast.error(err.message || "Failed to send SMS");
                        }
                      }}
                    >
                      <Send className="h-4 w-4 mr-1" /> Send Payment SMS
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call Link */}
          {order.call_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Source Call
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/calls/${order.call_id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Call & Transcript
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
