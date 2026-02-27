import twilio from "twilio";

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return twilioClient;
}

export async function sendPaymentLinkSMS(params: {
  to: string;
  customerName: string;
  orderNumber: number;
  restaurantName: string;
  total: string;
  paymentUrl: string;
}): Promise<string> {
  const client = getTwilioClient();

  const message = await client.messages.create({
    to: params.to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: `Hi ${params.customerName}! Your order #${params.orderNumber} from ${params.restaurantName} is confirmed. Total: ${params.total}. Pay here: ${params.paymentUrl}`,
  });

  return message.sid;
}
