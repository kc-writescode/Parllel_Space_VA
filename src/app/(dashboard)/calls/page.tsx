"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRestaurant } from "@/hooks/use-restaurant";
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
import { formatDuration, formatPhone } from "@/lib/utils/formatters";
import { Phone, PhoneOff, AlertCircle } from "lucide-react";
import type { Database } from "@/types/database";

type Call = Database["public"]["Tables"]["calls"]["Row"];

const statusIcons: Record<string, React.ReactNode> = {
  completed: <Phone className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
  voicemail: <PhoneOff className="h-4 w-4 text-gray-400" />,
  in_progress: <Phone className="h-4 w-4 text-blue-500 animate-pulse" />,
};

export default function CallsPage() {
  const PAGE_SIZE = 25;

  const { restaurant } = useRestaurant();
  const supabase = createClient();
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const fetchCalls = useCallback(async (pageIndex: number) => {
    if (!restaurant) return;

    if (pageIndex === 0) setLoading(true);
    else setLoadingMore(true);

    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from("calls")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    const fetched = data || [];
    setCalls((prev) => (pageIndex === 0 ? fetched : [...prev, ...fetched]));
    setHasMore(fetched.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [restaurant, supabase]);

  useEffect(() => {
    setPage(0);
    fetchCalls(0);
  }, [fetchCalls]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchCalls(next);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading calls...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Call History</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Caller</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No calls yet. They&apos;ll appear here when customers call.
                      </TableCell>
                    </TableRow>
                  ) : (
                    calls.map((call) => (
                      <TableRow
                        key={call.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setSelectedCall(call)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {statusIcons[call.status]}
                            <span className="capitalize text-sm">{call.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {call.caller_phone ? formatPhone(call.caller_phone) : "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(call.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-sm">
                          {call.duration_ms ? formatDuration(call.duration_ms) : "—"}
                        </TableCell>
                        <TableCell>
                          {call.order_id ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Order placed
                            </Badge>
                          ) : (
                            <span className="text-sm text-gray-400">No order</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {hasMore && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>

        {/* Transcript Panel */}
        <div>
          {selectedCall ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Call Transcript</CardTitle>
                <p className="text-xs text-gray-500">
                  {selectedCall.caller_phone ? formatPhone(selectedCall.caller_phone) : "Unknown"}
                  {" · "}
                  {selectedCall.duration_ms ? formatDuration(selectedCall.duration_ms) : ""}
                </p>
              </CardHeader>
              <CardContent>
                {selectedCall.transcript && Array.isArray(selectedCall.transcript) ? (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {(selectedCall.transcript as { role: string; content: string }[]).map((entry, i) => (
                      <div key={i} className={`text-sm ${entry.role === "agent" ? "text-blue-700" : "text-gray-800"}`}>
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
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-400 text-sm">
                Select a call to view transcript
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
