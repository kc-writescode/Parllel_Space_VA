import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/lib/utils/constants";

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={ORDER_STATUS_COLORS[status] || "bg-gray-100 text-gray-800"} variant="secondary">
      {ORDER_STATUS_LABELS[status] || status}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={PAYMENT_STATUS_COLORS[status] || "bg-gray-100 text-gray-800"} variant="secondary">
      {PAYMENT_STATUS_LABELS[status] || status}
    </Badge>
  );
}
