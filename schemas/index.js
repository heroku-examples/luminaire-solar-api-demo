export const systemSchema = {
  type: 'object',
  description:
    'Represents a solar energy system installation with complete location details. This schema contains all geographical information needed to identify where a solar system is physically located.',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the solar system installation',
    },
    address: {
      type: 'string',
      description: 'Street address where the solar system is installed',
    },
    city: {
      type: 'string',
      description: 'City where the solar system is located',
    },
    state: {
      type: 'string',
      description: 'State or province where the solar system is located',
    },
    zip: {
      type: 'string',
      description: 'Postal or ZIP code for the solar system location',
    },
    country: {
      type: 'string',
      description: 'Country where the solar system is installed',
    },
    battery_storage: {
      type: 'number',
      description: 'Stored battery power of the solar system as a percentage.',
    },
    components: {
      type: 'array',
      items: { $ref: 'systemComponent#' },
      description: 'List of system components within the solar system',
    },
  },
  required: ['address', 'city', 'state', 'zip', 'country'],
};

export const systemComponentSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    system_id: { type: 'string', format: 'uuid' },
    product_id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    active: { type: 'boolean' },
  },
};

export const activityHistorySchema = {
  type: 'object',
  properties: {
    pastMonth: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          total_energy_produced: {
            type: 'number',
          },
          total_energy_consumed: {
            type: 'number',
          },
          date: { type: 'string', format: 'datetime' },
        },
      },
    },
  },
};

export const systemWeatherSchema = {
  type: 'object',
  properties: {
    temperature: { type: 'number' },
    description: { type: 'string' },
  },
  required: ['temperature', 'description'],
};

export const metricSchema = {
  type: 'object',
  description:
    'Energy production and consumption metrics for a specific solar system at a particular point in time. This schema tracks the energy performance data that is essential for monitoring system efficiency.',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for this specific metric record',
    },
    system_id: {
      type: 'string',
      format: 'uuid',
      description: 'Reference to the solar system that generated these metrics',
    },
    energy_produced: {
      type: 'number',
      description:
        'Amount of energy produced by the solar system in kilowatt-hours (kWh)',
    },
    energy_consumed: {
      type: 'number',
      description:
        'Amount of energy consumed by the property in kilowatt-hours (kWh)',
    },
    datetime: {
      type: 'string',
      format: 'date-time',
      description: 'Exact date and time when these metrics were recorded',
    },
  },
  required: ['system_id', 'energy_produced', 'energy_consumed'],
};

export const summarySchema = {
  type: 'object',
  description:
    'Aggregated energy metrics summary for a specific date, providing totals of energy production and consumption. This schema is used for reporting and analysis of energy patterns over time.',
  properties: {
    date: {
      type: 'string',
      format: 'date',
      description: 'The specific date for which this energy summary applies',
    },
    total_energy_produced: {
      type: 'number',
      description:
        'Total energy produced by the solar system on this date in kilowatt-hours (kWh)',
    },
    total_energy_consumed: {
      type: 'number',
      description:
        'Total energy consumed by the property on this date in kilowatt-hours (kWh)',
    },
  },
  required: ['total_energy_produced', 'total_energy_consumed'],
};

export const allSummarySchema = {
  type: 'object',
  description:
    'Comprehensive collection of energy summaries across different time periods (daily, past week, past month). This schema provides a complete overview of energy performance for trend analysis and reporting.',
  properties: {
    daily: {
      type: 'object',
      $ref: 'summary#',
      description:
        'Collection of daily energy summaries showing day-by-day performance',
    },
    weekly: {
      type: 'object',
      $ref: 'summary#',
      description: 'Weekly energy summary showing week-by-week performance',
    },
    monthly: {
      type: 'object',
      $ref: 'summary#',
      description: 'Monthly energy summary showing month-by-month performance',
    },
  },
  required: ['daily', 'weekly', 'monthly'],
};

export const userSchema = {
  type: 'object',
  description:
    'User account information for authentication and profile management. This schema contains all personal details and credentials needed for system access and user identification.',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the user account',
    },
    name: { type: 'string', description: "User's first name" },
    last_name: {
      type: 'string',
      description: "User's last name or family name",
    },
    email: {
      type: 'string',
      format: 'email',
      description:
        "User's email address for communications and account recovery",
    },
    username: {
      type: 'string',
      description: 'Unique username for login and identification',
    },
    password: {
      type: 'string',
      format: 'password',
      description: "User's password for account security (stored securely)",
    },
  },
  required: ['name', 'last_name', 'email', 'username'],
};

export const productSchema = {
  type: 'object',
  description:
    'Solar product information including details about available solar equipment and accessories. This schema contains all product specifications and pricing information for customer purchase decisions.',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique identifier for the product',
    },
    name: {
      type: 'string',
      description: 'Name of the solar product or equipment',
    },
    description: {
      type: 'string',
      description:
        'Detailed description of the product including features and benefits',
    },
    imageUrl: {
      type: 'string',
      description: 'URL to the product image for display purposes',
    },
    price: {
      type: 'number',
      description: 'Current price of the product in the default currency',
    },
    productCode: {
      type: 'string',
      description: 'Unique SKU or product code for inventory management',
    },
  },
  required: ['name', 'description', 'imageUrl'],
};

export const forecastSchema = {
  type: 'object',
  properties: {
    date: { type: 'string', format: 'date' },
    irradiation: { type: 'number' },
  },
};

export const errorSchema = {
  type: 'object',
  description:
    'Standardized error response format for API error handling. This schema provides consistent error information including status codes and messages for troubleshooting and user feedback.',
  properties: {
    statusCode: {
      type: 'number',
      description: 'HTTP status code indicating the type of error encountered',
    },
    error: {
      type: 'string',
      description: 'Error type or category for classification purposes',
    },
    message: {
      type: 'string',
      description: 'Human-readable error message explaining what went wrong',
    },
  },
  required: ['statusCode', 'error', 'message'],
};

export const chatSchema = {
  type: 'object',
  description:
    'Request payload for initiating or continuing a conversation with the AI assistant. This schema defines the structure for sending questions to the AI and optionally maintaining conversation context across multiple interactions.',
  properties: {
    question: {
      type: 'string',
      description:
        "The user's question or message to be processed by the AI assistant. This can be a direct question, follow-up query, or any text input that requires AI processing.",
    },
    sessionId: {
      type: 'string',
      description:
        'Optional unique identifier for maintaining conversation context across multiple interactions. If provided, the AI will have access to previous messages in this session. If omitted, a new session will be created.',
    },
  },
  required: ['question'],
};

export const chatResponseSchema = {
  type: 'object',
  description:
    "Individual message chunk from the AI assistant's streaming response. This schema defines the structure of each piece of the response as it is streamed back to the client in real-time.",
  properties: {
    role: {
      type: 'string',
      enum: ['user', 'assistant', 'agent', 'error'],
      description:
        'Identifies the sender of the message chunk. "user" indicates content from the user, "assistant" for direct AI responses, "agent" for system-generated messages, and "error" for error notifications.',
    },
    content: {
      type: 'string',
      description:
        'The actual text content of this message chunk. For streaming responses, this will be a fragment of the complete response that should be appended to previous chunks.',
    },
  },
  required: ['role', 'content'],
};

export const chatHistorySchema = {
  type: 'object',
  description:
    'Request parameters for retrieving conversation history. This schema defines the structure for requesting past messages from a specific chat session, with options to limit the number of messages returned.',
  properties: {
    sessionId: {
      type: 'string',
      description:
        'Unique identifier of the chat session whose history should be retrieved. This ID connects all messages that belong to the same conversation thread.',
    },
    limit: {
      type: 'integer',
      description:
        'Maximum number of historical messages to retrieve, starting with the most recent. Defaults to 10 if not specified. Use this to control the volume of data returned.',
      default: 10,
    },
  },
  required: ['sessionId'],
};

export const chatHistoryResponseSchema = {
  type: 'array',
  description:
    'Collection of historical chat messages from a specific session. This schema defines the structure of the conversation history, with each item representing a complete message in chronological order.',
  items: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description:
          'Unique identifier for this specific message within the conversation',
      },
      session_id: {
        type: 'string',
        description:
          'Identifier of the chat session this message belongs to, linking it to other messages in the same conversation',
      },
      user_id: {
        type: 'string',
        nullable: true,
        description:
          'Identifier of the user who sent this message, if applicable. Null for system or AI-generated messages.',
      },
      role: {
        type: 'string',
        description:
          'Indicates who sent the message: "user" for user messages, "assistant" for AI responses, "agent" for system messages',
      },
      content: {
        type: 'string',
        description: 'The complete text content of the message',
      },
      timestamp: {
        type: 'string',
        format: 'date-time',
        description:
          'Exact date and time when this message was sent or generated',
      },
    },
  },
};

export const clearChatHistorySchema = {
  type: 'object',
  description: 'Clear chat history for a session',
  properties: {
    sessionId: {
      type: 'string',
      description: 'The session ID to clear history for',
    },
  },
  required: ['sessionId'],
};

export const clearChatHistoryResponseSchema = {
  type: 'object',
  description: 'Chat history cleared response',
  properties: {
    deleted: { type: 'integer' },
    sessionId: { type: 'string' },
  },
};
