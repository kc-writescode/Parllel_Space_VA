import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle } from "lucide-react";

interface PayPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ status?: string }>;
}

export default async function PayPage({ params, searchParams }: PayPageProps) {
  const { orderId } = await params;
  const { status: paymentStatus } = await searchParams;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*), restaurants(*)")
    .eq("id", orderId)
    .single();

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold">Order Not Found</h2>
            <p className="text-gray-500 mt-2">This order link may have expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = order.payment_status === "paid" || paymentStatus === "success";

  // If not paid and we have a payment link, redirect
  if (!isPaid && order.stripe_payment_link_url && paymentStatus !== "cancelled") {
    return (
      <meta httpEquiv="refresh" content={`0;url=${order.stripe_payment_link_url}`} />
    );
  }

  const restaurant = order.restaurants as unknown as { name: string };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{restaurant?.name}</CardTitle>
          <p className="text-sm text-gray-500">Order #{order.order_number}</p>
        </CardHeader>
        <CardContent>
          {isPaid ? (
            <div className="text-center mb-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-green-700">Payment Successful!</h2>
              <p className="text-gray-500 mt-1">Your order is being prepared.</p>
            </div>
          ) : paymentStatus === "cancelled" ? (
            <div className="text-center mb-6">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-red-700">Payment Cancelled</h2>
              <p className="text-gray-500 mt-1">
                Your order is still pending.{" "}
                {order.stripe_payment_link_url && (
                  <a href={order.stripe_payment_link_url} className="text-blue-600 underline">
                    Try again
                  </a>
                )}
              </p>
            </div>
          ) : (
            <div className="text-center mb-6">
              <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold">Payment Pending</h2>
            </div>
          )}

          {/* Order Summary */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Order Details</span>
              <Badge variant="outline">{order.order_type}</Badge>
            </div>
            {order.order_items?.map((item: { id: string; quantity: number; name: string; item_total: number }) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.quantity}x {item.name}</span>
                <span>{formatCurrency(item.item_total)}</span>
              </div>
            ))}
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Tax</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>
              {order.delivery_fee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-1 border-t">
                <span>Total</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
