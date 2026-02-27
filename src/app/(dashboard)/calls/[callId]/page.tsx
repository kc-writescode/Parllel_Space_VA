"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPhone, formatDuration } from "@/lib/utils/formatters";
import {
  ArrowLeft,
  Phone,
  Clock,
  FileText,
  ShoppingCart,
  ExternalLink,
  Mic,
  Bot,
  User,
} from "lucide-react";

export default function CallDetailPage() {
  const params = useParams();
  const callId = params.callId as string;
  const supabase = createClient();

  const [call, setCall] = useState<any>(null);
  const [linkedOrder, setLinkedOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!callId) return;

    async function fetchCall() {
      const { data } = await supabase
        .from("calls")
        .select("*")
        .eq("id", callId)
        .single();

      setCall(data);

      if (data?.order_id) {
        const { data: orderData } = await supabase
          .from("orders")
          .select("id, order_number, total, status")
          .eq("id", data.order_id)
          .single();
        setLinkedOrder(orderData);
      }

      setLoading(false);
    }

    fetchCall();
  }, [callId, supabase]);

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

  const statusColor =
    call.status === "completed"
      ? "bg-green-100 text-green-700"
      : call.status === "in_progress"
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-700";

  // Parse transcript — Retell sends as array of { role, content } objects
  const transcript: { role: string; content: string }[] = Array.isArray(call.transcript)
    ? call.transcript
    : [];

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
              Call from {call.caller_phone ? formatPhone(call.caller_phone) : "Unknown"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(call.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        <Badge className={statusColor} variant="secondary">
          {call.status === "completed" ? "Completed" : call.status === "in_progress" ? "In Progress" : call.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Transcript */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transcript.length > 0 ? (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-4">
                    {transcript.map((msg, i) => {
                      const isAgent = msg.role === "agent";
                      return (
                        <div key={i} className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            isAgent ? "bg-blue-100" : "bg-gray-100"
                          }`}>
                            {isAgent ? (
                              <Bot className="h-4 w-4 text-blue-600" />
                            ) : (
                              <User className="h-4 w-4 text-gray-600" />
                            )}
                          </div>
                          <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            isAgent
                              ? "bg-blue-50 text-gray-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
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

        {/* Right Column - Call Info */}
        <div className="space-y-6">
          {/* Call Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4" /> Call Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Caller</p>
                  <p className="text-sm font-medium">
                    {call.caller_phone ? formatPhone(call.caller_phone) : "Unknown"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Duration</p>
                  <p className="text-sm font-medium">
                    {call.duration_ms ? formatDuration(call.duration_ms) : "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Retell Call ID</p>
                  <p className="text-xs text-gray-400 break-all">{call.retell_call_id || "N/A"}</p>
                </div>
              </div>

              {call.recording_url && (
                <>
                  <Separator />
                  <a
                    href={call.recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Listen to Recording
                  </a>
                </>
              )}
            </CardContent>
          </Card>

          {/* Linked Order */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" /> Linked Order
              </CardTitle>
            </CardHeader>
            <CardContent>
              {linkedOrder ? (
                <Link href={`/orders/${linkedOrder.id}`}>
                  <div className="p-3 rounded-lg border hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">#{linkedOrder.order_number}</span>
                      <Badge variant="secondary" className="text-xs">
                        {linkedOrder.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Total: ${(linkedOrder.total || 0).toFixed(2)}
                    </p>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No order was placed during this call.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Call Analysis */}
          {call.call_analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {typeof call.call_analysis === "string" ? call.call_analysis : JSON.stringify(call.call_analysis, null, 2)}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
