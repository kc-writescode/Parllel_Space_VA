"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPhone, formatDuration, formatCurrency } from "@/lib/utils/formatters";
import {
  ArrowLeft,
  Phone,
  Clock,
  Volume2,
  ShoppingCart,
  Bot,
  User,
  Package,
} from "lucide-react";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  item_total: number;
  modifiers: { group: string; option: string }[] | null;
  special_instructions: string | null;
}

interface Order {
  id: string;
  order_number: number;
  total: number;
  subtotal: number;
  tax: number;
  delivery_fee: number;
  status: string;
  payment_status: string;
  order_type: string;
  delivery_address: string | null;
}

interface CallDetail {
  id: string;
  retell_call_id: string;
  caller_phone: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  recording_url: string | null;
  transcript: { role: string; content: string }[] | null;
  call_analysis: Record<string, unknown> | null;
  disconnection_reason: string | null;
  order: Order | null;
  order_items: OrderItem[] | null;
}

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  error: "bg-red-100 text-red-700",
  voicemail: "bg-gray-100 text-gray-700",
};

export default function CallDetailPage() {
  const params = useParams();
  const callId = params.callId as string;

  const [call, setCall] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!callId) return;
    fetch(`/api/calls/${callId}`)
      .then((r) => r.json())
      .then((data) => {
        setCall(data.error ? null : data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [callId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading call...</p>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-gray-500">Call not found.</p>
        <Link href="/calls">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Calls
          </Button>
        </Link>
      </div>
    );
  }

  const transcript = Array.isArray(call.transcript) ? call.transcript : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/calls">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Calls
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {call.caller_phone ? formatPhone(call.caller_phone) : "Unknown caller"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {call.started_at ? new Date(call.started_at).toLocaleString() : ""}
              {call.duration_ms ? ` · ${formatDuration(call.duration_ms)}` : ""}
            </p>
          </div>
        </div>
        <Badge
          className={statusColors[call.status] ?? statusColors.completed}
          variant="secondary"
        >
          {call.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Audio Player */}
      {call.recording_url && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="h-4 w-4" /> Voice Recording
            </CardTitle>
          </CardHeader>
          <CardContent>
            <audio controls className="w-full" src={call.recording_url} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transcript */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" /> Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transcript.length > 0 ? (
                <ScrollArea className="h-125 pr-4">
                  <div className="space-y-4">
                    {transcript.map((msg, i) => {
                      const isAgent = msg.role === "agent";
                      return (
                        <div
                          key={i}
                          className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}
                        >
                          <div
                            className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                              isAgent ? "bg-blue-100" : "bg-gray-100"
                            }`}
                          >
                            {isAgent ? (
                              <Bot className="h-4 w-4 text-blue-600" />
                            ) : (
                              <User className="h-4 w-4 text-gray-600" />
                            )}
                          </div>
                          <div
                            className={`max-w-[80%] rounded-lg px-4 py-2 ${
                              isAgent ? "bg-blue-50 text-gray-800" : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            <p className="text-xs font-medium mb-1 text-gray-500">
                              {isAgent ? "AI Agent" : "Customer"}
                            </p>
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">
                  No transcript available for this call.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Call Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Call Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Caller</span>
                <span className="font-medium">
                  {call.caller_phone ? formatPhone(call.caller_phone) : "Unknown"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium">
                  {call.duration_ms ? formatDuration(call.duration_ms) : "N/A"}
                </span>
              </div>
              {call.started_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Started</span>
                  <span>{new Date(call.started_at).toLocaleTimeString()}</span>
                </div>
              )}
              {call.ended_at && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Ended</span>
                  <span>{new Date(call.ended_at).toLocaleTimeString()}</span>
                </div>
              )}
              {call.disconnection_reason && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Ended by</span>
                  <span className="capitalize text-xs">
                    {call.disconnection_reason.replace(/_/g, " ")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          {call.order ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Order #{call.order.order_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Items */}
                {call.order_items && call.order_items.length > 0 && (
                  <div className="space-y-2">
                    {call.order_items.map((item) => (
                      <div key={item.id} className="text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {item.quantity}× {item.name}
                          </span>
                          <span>{formatCurrency(item.item_total)}</span>
                        </div>
                        {Array.isArray(item.modifiers) && item.modifiers.length > 0 && (
                          <p className="text-xs text-gray-500 ml-4">
                            {item.modifiers.map((m) => m.option).join(", ")}
                          </p>
                        )}
                        {item.special_instructions && (
                          <p className="text-xs text-gray-400 ml-4 italic">
                            {item.special_instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span>
                    <span>{formatCurrency(call.order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Tax</span>
                    <span>{formatCurrency(call.order.tax)}</span>
                  </div>
                  {call.order.delivery_fee > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Delivery</span>
                      <span>{formatCurrency(call.order.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(call.order.total)}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary" className="capitalize text-xs">
                    {call.order.order_type}
                  </Badge>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {call.order.status}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`capitalize text-xs ${
                      call.order.payment_status === "paid"
                        ? "bg-green-100 text-green-700"
                        : call.order.payment_status === "link_sent"
                        ? "bg-yellow-100 text-yellow-700"
                        : ""
                    }`}
                  >
                    {call.order.payment_status.replace("_", " ")}
                  </Badge>
                </div>

                {call.order.delivery_address && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Delivery to:</span>{" "}
                    {call.order.delivery_address}
                  </p>
                )}

                <Link href={`/orders/${call.order.id}`}>
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <Package className="h-3 w-3 mr-1" /> Manage Order
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" /> Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400 text-center py-4">
                  No order was placed during this call.
                </p>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis */}
          {call.call_analysis && Object.keys(call.call_analysis).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(call.call_analysis).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-gray-500 capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium capitalize text-right max-w-[60%]">
                      {String(value)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
