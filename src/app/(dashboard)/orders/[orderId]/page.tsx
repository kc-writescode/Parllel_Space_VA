"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/orders/order-status-badge";
import { formatCurrency, formatPhone, formatDuration } from "@/lib/utils/formatters";
import {
  ArrowLeft,
  MapPin,
  ShoppingBag,
  Phone,
  User,
  Clock,
  Printer,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CallRow = Database["public"]["Tables"]["calls"]["Row"];

type OrderDetail = OrderRow & {
  order_items?: OrderItemRow[];
  customer?: CustomerRow | null;
  call?: CallRow | null;
};

const STATUS_STEPS = [
  { key: "pending", label: "Pending", timestampKey: "created_at" },
  { key: "confirmed", label: "Confirmed", timestampKey: "confirmed_at" },
  { key: "preparing", label: "Preparing", timestampKey: "confirmed_at" },
  { key: "ready", label: "Ready", timestampKey: "ready_at" },
  { key: "completed", label: "Completed", timestampKey: "completed_at" },
];

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
  ready: "Mark Completed",
};

function getStatusIndex(status: string): number {
  if (status === "cancelled") return -1;
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

export default function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${params.orderId}`);
      const data = await res.json();
      if (res.ok && data.order) {
        setOrder(data.order);
      } else {
        setOrder(null);
      }
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [params.orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  async function updateStatus(newStatus: string) {
    if (!order) return;
    setUpdating(true);

    const updateData: Record<string, unknown> = { status: newStatus };
    const now = new Date().toISOString();
    if (newStatus === "confirmed") updateData.confirmed_at = now;
    if (newStatus === "ready") updateData.ready_at = now;
    if (newStatus === "completed") updateData.completed_at = now;

    const { error } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", order.id);

    setUpdating(false);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Order marked as ${newStatus}`);
      fetchOrder();
    }
  }

  async function cancelOrder() {
    if (!order) return;
    setUpdating(true);

    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    setUpdating(false);

    if (error) {
      toast.error("Failed to cancel order");
    } else {
      toast.success("Order cancelled");
      fetchOrder();
    }
  }

  function handlePrint() {
    window.print();
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
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">Order not found.</p>
        </div>
      </div>
    );
  }

  const currentIndex = getStatusIndex(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <>
      <div className="space-y-6 max-w-4xl">
        {/* Back and Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
              <Badge variant="outline">
                {order.order_type === "delivery" ? (
                  <><MapPin className="h-3 w-3 mr-1" /> Delivery</>
                ) : (
                  <><ShoppingBag className="h-3 w-3 mr-1" /> Pickup</>
                )}
              </Badge>
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Print Receipt
            </Button>
          </div>
        </div>

        {/* Status Timeline */}
        {!isCancelled && (
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((step, i) => {
                  const isCompleted = i <= currentIndex;
                  const isCurrent = i === currentIndex;
                  const timestamp = order[step.timestampKey as keyof OrderRow];

                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center relative">
                      {/* Connector line */}
                      {i > 0 && (
                        <div
                          className={`absolute top-4 right-1/2 h-0.5 ${i <= currentIndex ? "bg-green-500" : "bg-gray-200"
                            }`}
                          style={{ width: "100%", left: "-50%" }}
                        />
                      )}
                      {/* Circle */}
                      <div className="relative z-10">
                        {isCompleted ? (
                          <CheckCircle2
                            className={`h-8 w-8 ${isCurrent ? "text-blue-600" : "text-green-500"
                              }`}
                          />
                        ) : (
                          <Circle className="h-8 w-8 text-gray-300" />
                        )}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium ${isCompleted ? "text-gray-900" : "text-gray-400"
                          }`}
                      >
                        {step.label}
                      </span>
                      {timestamp && typeof timestamp === "string" && (
                        <span className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancelled banner */}
        {isCancelled && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-center">
              <p className="text-red-700 font-medium">
                This order was cancelled
                {order.cancelled_at &&
                  ` on ${new Date(order.cancelled_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main: Items */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Order Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {item.quantity}×
                          </span>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        {/* Modifiers */}
                        {item.modifiers &&
                          Array.isArray(item.modifiers) &&
                          (
                            item.modifiers as {
                              group: string;
                              option: string;
                              price?: number;
                            }[]
                          ).length > 0 && (
                            <div className="ml-6 mt-1 space-y-0.5">
                              {(
                                item.modifiers as {
                                  group: string;
                                  option: string;
                                  price?: number;
                                }[]
                              ).map((mod, mi) => (
                                <p
                                  key={mi}
                                  className="text-xs text-gray-500"
                                >
                                  {mod.group}: {mod.option}
                                  {mod.price && mod.price > 0
                                    ? ` (+${formatCurrency(mod.price)})`
                                    : ""}
                                </p>
                              ))}
                            </div>
                          )}
                        {/* Special instructions */}
                        {item.special_instructions && (
                          <p className="ml-6 mt-1 text-xs italic text-orange-600">
                            Note: {item.special_instructions}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(item.item_total)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Price Breakdown */}
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
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {!isCancelled && order.status !== "completed" && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex gap-3">
                    {nextStatus[order.status] && (
                      <Button
                        className="flex-1"
                        onClick={() => updateStatus(nextStatus[order.status])}
                        disabled={updating}
                      >
                        {updating
                          ? "Updating..."
                          : actionLabels[order.status]}
                      </Button>
                    )}
                    {order.status === "pending" && (
                      <Button
                        variant="destructive"
                        onClick={cancelOrder}
                        disabled={updating}
                      >
                        Cancel Order
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: Customer & Call Info */}
          <div className="space-y-6">
            {/* Customer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" /> Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {order.customer ? (
                  <>
                    <p className="font-medium">
                      {order.customer.name || "Unknown"}
                    </p>
                    {order.customer.phone && (
                      <a
                        href={`tel:${order.customer.phone}`}
                        className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {formatPhone(order.customer.phone)}
                      </a>
                    )}
                    {order.customer.email && (
                      <p className="text-sm text-gray-500">
                        {order.customer.email}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No customer info</p>
                )}
              </CardContent>
            </Card>

            {/* Delivery Info */}
            {order.order_type === "delivery" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Delivery Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.delivery_address ? (
                    <p className="text-sm">{order.delivery_address}</p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No address provided
                    </p>
                  )}
                  {order.delivery_notes && (
                    <p className="text-xs text-gray-500 italic">
                      {order.delivery_notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Call Info */}
            {order.call && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Call Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.call.caller_phone && (
                    <p className="text-sm">
                      From: {formatPhone(order.call.caller_phone)}
                    </p>
                  )}
                  {order.call.duration_ms && (
                    <p className="text-sm text-gray-500">
                      Duration: {formatDuration(order.call.duration_ms)}
                    </p>
                  )}
                  {order.call.id && (
                    <Link href={`/calls/${order.call.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1 text-xs"
                      >
                        View Call Transcript
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Timestamps */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Timestamps
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Created", value: order.created_at },
                  { label: "Confirmed", value: order.confirmed_at },
                  { label: "Ready", value: order.ready_at },
                  { label: "Completed", value: order.completed_at },
                  { label: "Cancelled", value: order.cancelled_at },
                  { label: "Paid", value: order.paid_at },
                ].map(
                  (ts) =>
                    ts.value && (
                      <div
                        key={ts.label}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-gray-500">{ts.label}</span>
                        <span>
                          {new Date(ts.value).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Hidden print area — Receipt */}
      <div ref={printRef} className="print-area">
        <div style={{ padding: "8px", fontFamily: "monospace", fontSize: "12px" }}>
          <h2 style={{ textAlign: "center", fontSize: "16px", margin: "0 0 4px" }}>
            Order #{order.order_number}
          </h2>
          <p style={{ textAlign: "center", fontSize: "10px", color: "#666", margin: "0 0 8px" }}>
            {new Date(order.created_at).toLocaleString()}
          </p>
          <p style={{ textAlign: "center", fontWeight: "bold", margin: "0 0 8px" }}>
            {order.order_type.toUpperCase()}
          </p>

          {order.delivery_address && (
            <p style={{ fontSize: "11px", margin: "0 0 8px" }}>
              Deliver to: {order.delivery_address}
            </p>
          )}

          <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "8px 0" }} />

          {order.order_items?.map((item) => (
            <div key={item.id} style={{ marginBottom: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{item.quantity}× {item.name}</span>
                <span>{formatCurrency(item.item_total)}</span>
              </div>
              {item.modifiers &&
                Array.isArray(item.modifiers) &&
                (item.modifiers as { group: string; option: string }[]).map(
                  (mod, mi) => (
                    <div key={mi} style={{ paddingLeft: "12px", fontSize: "10px", color: "#555" }}>
                      {mod.option}
                    </div>
                  )
                )}
              {item.special_instructions && (
                <div style={{ paddingLeft: "12px", fontSize: "10px", fontStyle: "italic", color: "#888" }}>
                  Note: {item.special_instructions}
                </div>
              )}
            </div>
          ))}

          <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "8px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Tax</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span>Delivery Fee</span>
              <span>{formatCurrency(order.delivery_fee)}</span>
            </div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid #000", margin: "6px 0" }} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            <span>TOTAL</span>
            <span>{formatCurrency(order.total)}</span>
          </div>

          <hr style={{ border: "none", borderTop: "1px dashed #000", margin: "8px 0" }} />

          {order.customer && (
            <div style={{ fontSize: "11px", marginBottom: "4px" }}>
              <p style={{ margin: 0 }}>{order.customer.name || "Guest"}</p>
              {order.customer.phone && (
                <p style={{ margin: 0, color: "#555" }}>{order.customer.phone}</p>
              )}
            </div>
          )}

          <p
            style={{
              textAlign: "center",
              fontSize: "12px",
              marginTop: "12px",
              fontWeight: "bold",
            }}
          >
            Thank you!
          </p>
        </div>
      </div>
    </>
  );
}
