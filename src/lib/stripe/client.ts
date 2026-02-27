import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-01-28.clover",
    });
  }
  return stripeClient;
}

export async function createPaymentLink(params: {
  orderId: string;
  restaurantName: string;
  total: number; // in dollars
  customerEmail?: string;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Order from ${params.restaurantName}`,
            description: `Order #${params.orderId.slice(0, 8)}`,
          },
          unit_amount: Math.round(params.total * 100), // Stripe uses cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${params.orderId}?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${params.orderId}?status=cancelled`,
    metadata: {
      order_id: params.orderId,
    },
    ...(params.customerEmail ? { customer_email: params.customerEmail } : {}),
  });

  return {
    url: session.url!,
    sessionId: session.id,
  };
}
