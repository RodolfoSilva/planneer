import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ExternalServiceError } from "../../lib/errors";
import { retryWithBackoff } from "@planneer/shared";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

interface FunctionCallResult {
  name: string;
  arguments: Record<string, any>;
}

interface ChatWithFunctionsResult {
  content: string;
  functionCalls?: FunctionCallResult[];
}

export class LLMService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private primaryProvider: "openai" | "anthropic" = "openai";

  constructor() {
    const openaiKey = process.env.OPENAI_API_KEY?.trim();
    const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

    if (openaiKey && openaiKey.length > 0) {
      try {
        this.openai = new OpenAI({
          apiKey: openaiKey,
        });
        console.log("✅ OpenAI client initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize OpenAI client:", error);
      }
    } else {
      console.warn(
        "⚠️  OPENAI_API_KEY not found or empty in environment variables"
      );
    }

    if (anthropicKey && anthropicKey.length > 0) {
      try {
        this.anthropic = new Anthropic({
          apiKey: anthropicKey,
        });
        console.log("✅ Anthropic client initialized successfully");
      } catch (error) {
        console.error("❌ Failed to initialize Anthropic client:", error);
      }
    } else {
      console.warn(
        "⚠️  ANTHROPIC_API_KEY not found or empty in environment variables"
      );
    }

    // Set primary provider based on available keys
    if (this.openai) {
      this.primaryProvider = "openai";
    } else if (this.anthropic) {
      this.primaryProvider = "anthropic";
    } else {
      console.error(
        "❌ No LLM providers available. Please configure OPENAI_API_KEY or ANTHROPIC_API_KEY"
      );
    }
  }

  async chat(
    messages: ChatMessage[],
    options: LLMOptions = {}
  ): Promise<string> {
    const { maxTokens = 4096, temperature = 0.7 } = options;

    // Check if any provider is available
    if (!this.openai && !this.anthropic) {
      throw new ExternalServiceError(
        "LLM",
        "No LLM providers configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your environment variables."
      );
    }

    // Try primary provider first, then fallback
    try {
      if (this.primaryProvider === "openai" && this.openai) {
        return await this.chatWithOpenAI(messages, maxTokens, temperature);
      } else if (this.anthropic) {
        return await this.chatWithAnthropic(messages, maxTokens, temperature);
      }
    } catch (error: any) {
      console.error(
        `Primary provider (${this.primaryProvider}) failed:`,
        error
      );
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type,
      });

      // Try fallback
      try {
        if (this.primaryProvider === "openai" && this.anthropic) {
          console.log("Falling back to Anthropic...");
          return await this.chatWithAnthropic(messages, maxTokens, temperature);
        } else if (this.primaryProvider === "anthropic" && this.openai) {
          console.log("Falling back to OpenAI...");
          return await this.chatWithOpenAI(messages, maxTokens, temperature);
        }
      } catch (fallbackError: any) {
        console.error("Fallback provider also failed:", fallbackError);
        console.error("Fallback error details:", {
          message: fallbackError?.message,
          status: fallbackError?.status,
          code: fallbackError?.code,
          type: fallbackError?.type,
        });
      }
    }

    throw new ExternalServiceError(
      "LLM",
      "All providers failed. Please check API keys and ensure they are valid and have sufficient credits."
    );
  }

  /**
   * Chat with function calling support
   * Returns both the text response and any function calls made by the LLM
   */
  async chatWithFunctions(
    messages: ChatMessage[],
    functions: FunctionDefinition[],
    options: LLMOptions = {}
  ): Promise<ChatWithFunctionsResult> {
    const { maxTokens = 4096, temperature = 0.7 } = options;

    // Check if any provider is available
    if (!this.openai && !this.anthropic) {
      throw new ExternalServiceError(
        "LLM",
        "No LLM providers configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your environment variables."
      );
    }

    // Try primary provider first, then fallback
    try {
      if (this.primaryProvider === "openai" && this.openai) {
        return await this.chatWithOpenAIFunctions(
          messages,
          functions,
          maxTokens,
          temperature
        );
      } else if (this.anthropic) {
        return await this.chatWithAnthropicTools(
          messages,
          functions,
          maxTokens,
          temperature
        );
      }
    } catch (error: any) {
      console.error(
        `Primary provider (${this.primaryProvider}) failed:`,
        error
      );
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        code: error?.code,
        type: error?.type,
      });

      // Try fallback
      try {
        if (this.primaryProvider === "openai" && this.anthropic) {
          console.log("Falling back to Anthropic...");
          return await this.chatWithAnthropicTools(
            messages,
            functions,
            maxTokens,
            temperature
          );
        } else if (this.primaryProvider === "anthropic" && this.openai) {
          console.log("Falling back to OpenAI...");
          return await this.chatWithOpenAIFunctions(
            messages,
            functions,
            maxTokens,
            temperature
          );
        }
      } catch (fallbackError: any) {
        console.error("Fallback provider also failed:", fallbackError);
        console.error("Fallback error details:", {
          message: fallbackError?.message,
          status: fallbackError?.status,
          code: fallbackError?.code,
          type: fallbackError?.type,
        });
      }
    }

    throw new ExternalServiceError(
      "LLM",
      "All providers failed. Please check API keys and ensure they are valid and have sufficient credits."
    );
  }

  private async chatWithOpenAI(
    messages: ChatMessage[],
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    try {
      const response = await retryWithBackoff(
        async () => {
          return this.openai!.chat.completions.create({
            model: "gpt-4o", // Updated to a more stable model
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            max_tokens: maxTokens,
            temperature,
          });
        },
        3,
        1000
      );

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      return content;
    } catch (error: any) {
      // Provide more detailed error information
      if (error?.status === 401) {
        throw new Error(
          "OpenAI API key is invalid or expired. Please check your OPENAI_API_KEY."
        );
      } else if (error?.status === 429) {
        throw new Error(
          "OpenAI API rate limit exceeded. Please try again later."
        );
      } else if (
        error?.status === 500 ||
        error?.status === 502 ||
        error?.status === 503
      ) {
        throw new Error(
          "OpenAI API is temporarily unavailable. Please try again later."
        );
      }
      throw error;
    }
  }

  private async chatWithAnthropic(
    messages: ChatMessage[],
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    if (!this.anthropic) {
      throw new Error("Anthropic client not initialized");
    }

    // Extract system message
    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";
    const chatMessages = messages.filter((m) => m.role !== "system");

    const response = await retryWithBackoff(
      async () => {
        return this.anthropic!.messages.create({
          model: "claude-3-sonnet-20240229",
          max_tokens: maxTokens,
          temperature,
          system: systemMessage,
          messages: chatMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        });
      },
      3,
      1000
    );

    const content = response.content[0];

    if (content.type !== "text") {
      throw new Error("Unexpected response type from Anthropic");
    }

    return content.text;
  }

  private async chatWithOpenAIFunctions(
    messages: ChatMessage[],
    functions: FunctionDefinition[],
    maxTokens: number,
    temperature: number
  ): Promise<ChatWithFunctionsResult> {
    if (!this.openai) {
      throw new Error("OpenAI client not initialized");
    }

    try {
      const response = await retryWithBackoff(
        async () => {
          return this.openai!.chat.completions.create({
            model: "gpt-4o",
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            functions: functions.map((f) => ({
              name: f.name,
              description: f.description,
              parameters: f.parameters,
            })),
            function_call: "auto",
            max_tokens: maxTokens,
            temperature,
          });
        },
        3,
        1000
      );

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error("Empty response from OpenAI");
      }

      const result: ChatWithFunctionsResult = {
        content: message.content || "",
        functionCalls: [],
      };

      // Extract function calls
      if (message.function_call) {
        try {
          const args = JSON.parse(message.function_call.arguments || "{}");
          result.functionCalls?.push({
            name: message.function_call.name,
            arguments: args,
          });
        } catch (error) {
          console.error("Error parsing function call arguments:", error);
        }
      }

      return result;
    } catch (error: any) {
      if (error?.status === 401) {
        throw new Error(
          "OpenAI API key is invalid or expired. Please check your OPENAI_API_KEY."
        );
      } else if (error?.status === 429) {
        throw new Error(
          "OpenAI API rate limit exceeded. Please try again later."
        );
      } else if (
        error?.status === 500 ||
        error?.status === 502 ||
        error?.status === 503
      ) {
        throw new Error(
          "OpenAI API is temporarily unavailable. Please try again later."
        );
      }
      throw error;
    }
  }

  private async chatWithAnthropicTools(
    messages: ChatMessage[],
    functions: FunctionDefinition[],
    maxTokens: number,
    temperature: number
  ): Promise<ChatWithFunctionsResult> {
    if (!this.anthropic) {
      throw new Error("Anthropic client not initialized");
    }

    // Extract system message
    const systemMessage =
      messages.find((m) => m.role === "system")?.content || "";
    const chatMessages = messages.filter((m) => m.role !== "system");

    // For Anthropic SDK 0.17.0, we need to use a newer model that supports tools
    // Try using claude-3-5-sonnet-20241022 or fallback to structured output approach
    try {
      // Convert functions to Anthropic tools format
      const tools = functions.map((f) => ({
        name: f.name,
        description: f.description,
        input_schema: {
          type: "object" as const,
          properties: f.parameters.properties,
          required: f.parameters.required || [],
        },
      }));

      const response = await retryWithBackoff(
        async () => {
          // Try with newer model that supports tools
          return this.anthropic!.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: maxTokens,
            temperature,
            system: systemMessage,
            messages: chatMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
            tools: tools.length > 0 ? tools : undefined,
          } as any); // Type assertion needed for older SDK version
        },
        3,
        1000
      );

      const result: ChatWithFunctionsResult = {
        content: "",
        functionCalls: [],
      };

      // Process response content
      for (const block of response.content) {
        if (block.type === "text") {
          result.content += (block as any).text;
        } else if ((block as any).type === "tool_use") {
          result.functionCalls?.push({
            name: (block as any).name,
            arguments: (block as any).input,
          });
        }
      }

      return result;
    } catch (error: any) {
      // If tools are not supported, fallback to regular chat and parse structured output
      console.warn(
        "[LLMService] Anthropic tools not supported, falling back to structured output parsing:",
        error.message
      );

      // Add instructions to return structured JSON with function calls
      const enhancedSystemMessage = `${systemMessage}

IMPORTANTE: Quando você quiser indicar uma intenção, retorne um JSON estruturado no formato:
{
  "response": "sua resposta ao usuário",
  "functionCalls": [
    {"name": "nome_da_funcao", "arguments": {...}}
  ]
}

Funções disponíveis: ${functions.map((f) => f.name).join(", ")}`;

      const response = await retryWithBackoff(
        async () => {
          return this.anthropic!.messages.create({
            model: "claude-3-sonnet-20240229",
            max_tokens: maxTokens,
            temperature,
            system: enhancedSystemMessage,
            messages: chatMessages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          });
        },
        3,
        1000
      );

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type from Anthropic");
      }

      // Try to parse structured output
      try {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.response && parsed.functionCalls) {
            return {
              content: parsed.response,
              functionCalls: parsed.functionCalls,
            };
          }
        }
      } catch {
        // If parsing fails, return as regular text
      }

      return {
        content: content.text,
        functionCalls: [],
      };
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new ExternalServiceError(
        "Embeddings",
        "OpenAI API key required for embeddings"
      );
    }

    const response = await retryWithBackoff(
      async () => {
        return this.openai!.embeddings.create({
          model: "text-embedding-ada-002",
          input: text,
        });
      },
      3,
      1000
    );

    return response.data[0].embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new ExternalServiceError(
        "Embeddings",
        "OpenAI API key required for embeddings"
      );
    }

    // Process in batches of 100
    const batchSize = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await retryWithBackoff(
        async () => {
          return this.openai!.embeddings.create({
            model: "text-embedding-ada-002",
            input: batch,
          });
        },
        3,
        1000
      );

      embeddings.push(...response.data.map((d) => d.embedding));
    }

    return embeddings;
  }
}
