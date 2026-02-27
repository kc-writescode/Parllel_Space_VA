import Retell from "retell-sdk";

let retellClient: Retell | null = null;

export function getRetellClient(): Retell {
  if (!retellClient) {
    retellClient = new Retell({ apiKey: process.env.RETELL_API_KEY! });
  }
  return retellClient;
}

export interface CreateAgentResult {
  agentId: string;
  llmId: string;
}

export async function createRestaurantAgent(
  restaurantName: string,
  systemPrompt: string,
  tools: RetellTool[]
): Promise<CreateAgentResult> {
  const retell = getRetellClient();

  // Create the LLM configuration first
  const llm = await retell.llm.create({
    general_prompt: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    general_tools: tools as any,
    model: "gpt-4.1",
  });

  // Create the agent bound to the LLM
  const agent = await retell.agent.create({
    response_engine: {
      type: "retell-llm",
      llm_id: llm.llm_id,
    },
    voice_id: "11labs-Adrian",
    agent_name: `${restaurantName} Order Agent`,
    language: "en-US",
    responsiveness: 0.7,
    interruption_sensitivity: 0.6,
    enable_backchannel: true,
    end_call_after_silence_ms: 30000,
    max_call_duration_ms: 600000,
    webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/retell`,
    post_call_analysis_data: [
      {
        name: "order_placed",
        type: "boolean",
        description: "Whether the caller placed an order",
      },
      {
        name: "order_type",
        type: "enum",
        choices: ["pickup", "delivery"],
        description: "Pickup or delivery",
      },
      {
        name: "customer_satisfaction",
        type: "enum",
        choices: ["positive", "neutral", "negative"],
        description: "Caller sentiment",
      },
    ],
  });

  return {
    agentId: agent.agent_id,
    llmId: llm.llm_id,
  };
}

export async function provisionPhoneNumber(agentId: string): Promise<{
  phoneNumber: string;
  phoneNumberId: string;
}> {
  const retell = getRetellClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const phoneNumber = await retell.phoneNumber.create({
    agent_id: agentId,
    area_code: 415,
  } as any);

  return {
    phoneNumber: phoneNumber.phone_number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    phoneNumberId: (phoneNumber as any).phone_number_id || phoneNumber.phone_number,
  };
}

export async function updateAgentPrompt(
  llmId: string,
  systemPrompt: string,
  tools: RetellTool[]
): Promise<void> {
  const retell = getRetellClient();
  await retell.llm.update(llmId, {
    general_prompt: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    general_tools: tools as any,
  });
}

export interface RetellTool {
  type: "custom";
  name: string;
  description: string;
  url: string;
  speak_after_execution: boolean;
  speak_during_execution?: boolean;
  execution_message_description?: string;
  parameters?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export function getOrderingTools(appUrl?: string): RetellTool[] {
  const toolUrl = `${appUrl || process.env.NEXT_PUBLIC_APP_URL}/api/tools/retell`;
  return [
    {
      type: "custom",
      name: "add_to_order",
      description: "Add an item to the customer's order. Use this when a customer confirms they want an item.",
      url: toolUrl,
      speak_after_execution: true,
      execution_message_description: "I'll add that to your order.",
      parameters: {
        type: "object",
        properties: {
          item_name: { type: "string", description: "Name of the menu item" },
          quantity: { type: "number", description: "Number of this item (default 1)" },
          modifiers: {
            type: "array",
            description: "Selected modifiers for this item",
            items: {
              type: "object",
              properties: {
                group: { type: "string" },
                option: { type: "string" },
              },
            },
          },
          special_instructions: { type: "string", description: "Any special requests for this item" },
        },
        required: ["item_name", "quantity"],
      },
    },
    {
      type: "custom",
      name: "remove_from_order",
      description: "Remove an item from the customer's order",
      url: toolUrl,
      speak_after_execution: true,
      parameters: {
        type: "object",
        properties: {
          item_name: { type: "string", description: "Name of the item to remove" },
        },
        required: ["item_name"],
      },
    },
    {
      type: "custom",
      name: "get_order_summary",
      description: "Get the current order summary with all items and total. Call this before reading the order back.",
      url: toolUrl,
      speak_after_execution: true,
      parameters: {
        type: "object",
        properties: {},
      },
    },
    {
      type: "custom",
      name: "set_order_type",
      description: "Set whether the order is for pickup or delivery",
      url: toolUrl,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          order_type: { type: "string", enum: ["pickup", "delivery"], description: "Pickup or delivery" },
        },
        required: ["order_type"],
      },
    },
    {
      type: "custom",
      name: "set_delivery_address",
      description: "Set the delivery address for the order",
      url: toolUrl,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Full delivery address" },
        },
        required: ["address"],
      },
    },
    {
      type: "custom",
      name: "set_customer_info",
      description: "Set the customer's name and confirm phone number",
      url: toolUrl,
      speak_after_execution: false,
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Customer's name" },
          phone: { type: "string", description: "Customer phone in E.164 format" },
        },
        required: ["name"],
      },
    },
  ];
}
