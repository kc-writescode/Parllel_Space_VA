"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatDuration, formatPhone, formatCurrency } from "@/lib/utils/formatters";
import { Phone, PhoneOff, AlertCircle, ExternalLink, Volume2, Search } from "lucide-react";

interface OrderSummary {
  id: string;
  order_number: number;
  total: number;
  status: string;
  payment_status: string;
  order_type: string;
}

interface CallRecord {
  id: string | null;
  retell_call_id: string;
  caller_phone: string | null;
  status: string;
  started_at: string | null;
  duration_ms: number | null;
  recording_url: string | null;
  transcript: { role: string; content: string }[] | null;
  call_analysis: Record<string, unknown> | null;
  disconnection_reason: string | null;
  order: OrderSummary | null;
}

const statusIcons: Record<string, React.ReactNode> = {
  completed: <Phone className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  voicemail: <PhoneOff className="h-4 w-4 text-gray-400" />,
  in_progress: <Phone className="h-4 w-4 text-blue-500 animate-pulse" />,
};

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [search, setSearch] = useState("");

  const fetchCalls = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);

    const url = cursor ? `/api/calls?cursor=${cursor}` : "/api/calls";
    const res = await fetch(url);
    const data = await res.json();

    setCalls((prev) => (cursor ? [...prev, ...(data.calls || [])] : (data.calls || [])));
    setNextCursor(data.nextCursor ?? null);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const q = search.trim().toLowerCase();
  const visibleCalls = calls.filter((call) => {
    if (!q) return true;
    if (call.caller_phone?.toLowerCase().includes(q)) return true;
    if (call.status.toLowerCase().includes(q)) return true;
    if (call.order && String(call.order.order_number).includes(q)) return true;
    return false;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading calls...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Call History</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Call List */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardContent className="p-0">
              {/* Search bar */}
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    placeholder="Search by phone, status, or order #…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleCalls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        {q ? `No calls matching "${search}"` : "No calls yet. They'll appear here when customers call."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleCalls.map((call) => (
                      <TableRow
                        key={call.retell_call_id}
                        className={`cursor-pointer hover:bg-gray-50 ${selectedCall?.retell_call_id === call.retell_call_id ? "bg-blue-50" : ""}`}
                        onClick={() => setSelectedCall(call)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {statusIcons[call.status] ?? statusIcons.completed}
                            <span className="capitalize text-sm">{call.status.replace("_", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {call.caller_phone ? formatPhone(call.caller_phone) : "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {call.started_at
                            ? new Date(call.started_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {call.duration_ms ? formatDuration(call.duration_ms) : "—"}
                        </TableCell>
                        <TableCell>
                          {call.order ? (
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="secondary" className="bg-green-100 text-green-800 w-fit">
                                #{call.order.order_number}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {formatCurrency(call.order.total)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No order</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {call.recording_url && (
                            <a
                              href={call.recording_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-blue-600 transition-colors"
                              title="Open recording"
                            >
                              <Volume2 className="h-4 w-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {nextCursor && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchCalls(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div>
          {selectedCall ? (
            <div className="space-y-4">
              {/* Audio Player */}
              {selectedCall.recording_url && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Volume2 className="h-4 w-4" /> Recording
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <audio controls className="w-full h-10" src={selectedCall.recording_url} />
                  </CardContent>
                </Card>
              )}

              {/* Order Summary */}
              {selectedCall.order && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Order #{selectedCall.order.order_number}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Type</span>
                      <span className="capitalize">{selectedCall.order.order_type}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total</span>
                      <span className="font-medium">{formatCurrency(selectedCall.order.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Payment</span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {selectedCall.order.payment_status.replace("_", " ")}
                      </Badge>
                    </div>
                    {selectedCall.id && (
                      <Link href={`/orders/${selectedCall.order.id}`}>
                        <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
                          View full order <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Transcript */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Transcript</CardTitle>
                    {selectedCall.id && (
                      <Link href={`/calls/${selectedCall.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                          Full view <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {selectedCall.caller_phone ? formatPhone(selectedCall.caller_phone) : "Unknown"}
                    {selectedCall.duration_ms ? ` · ${formatDuration(selectedCall.duration_ms)}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  {selectedCall.transcript && selectedCall.transcript.length > 0 ? (
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                      {selectedCall.transcript.map((entry, i) => (
                        <div
                          key={i}
                          className={`text-sm ${entry.role === "agent" ? "text-blue-700" : "text-gray-800"}`}
                        >
                          <span className="font-semibold capitalize">{entry.role}: </span>
                          {entry.content}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No transcript available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-400 text-sm">
                Select a call to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
