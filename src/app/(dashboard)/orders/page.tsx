"use client";

import { useState } from "react";
import { OrderQueue } from "@/components/orders/order-queue";
import { CreateOrderDialog } from "@/components/orders/create-order-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function OrdersPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Order
        </Button>
      </div>
      <OrderQueue />
      <CreateOrderDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </div>
  );
}
