import { nanoid } from "nanoid";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../../db";
import {
  chatSessions,
  chatMessages,
  schedules,
  activities,
  wbs,
  projects,
  type ChatSessionContext,
} from "../../db/schema";
import { LLMService } from "../ai/llm";
import { RAGService } from "../ai/rag";
import { ScheduleGenerator } from "../scheduler";
import { PROJECT_TYPE_LABELS } from "@planneer/shared";
import { generateAndUploadXER } from "../export/xer-generator";

const llm = new LLMService();
const rag = new RAGService();
const scheduleGenerator = new ScheduleGenerator();

interface StartSessionOptions {
  userId: string;
  organizationId: string;
  projectType: string;
  projectDescription: string;
}

export class ChatService {
  /**
   * Get a chat session by ID
   */
  async getSession(sessionId: string) {
    return db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
    });
  }

  /**
   * Check if there's a pending user message that needs to be processed
   * Returns the last user message if it hasn't been responded to
   */
  async checkPendingMessage(
    sessionId: string
  ): Promise<{ id: string; content: string } | null> {
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: {
        messages: {
          orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        },
      },
    });

    if (!session || session.status !== "active") {
      return null;
    }

    // If there are no messages, nothing to process
    if (!session.messages || session.messages.length === 0) {
      return null;
    }

    // Get the last message
    const lastMessage = session.messages[0];

    // If the last message is from the user, it needs to be processed
    if (lastMessage.role === "user") {
      return {
        id: lastMessage.id,
        content: lastMessage.content,
      };
    }

    return null;
  }

  /**
   * Process an existing user message that hasn't been responded to
   * This is used when recovering from server restarts
   */
  async processExistingMessage(
    sessionId: string,
    userMessageId: string,
    userMessageContent: string
  ): Promise<void> {
    console.log("[ChatService] Processing existing message:", userMessageId);

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (!session) {
      console.error("[ChatService] Session not found:", sessionId);
      throw new Error("Session not found");
    }

    // Check if this message already has a response
    const messageIndex = session.messages.findIndex(
      (m) => m.id === userMessageId
    );
    if (messageIndex === -1) {
      console.error("[ChatService] Message not found:", userMessageId);
      return;
    }

    // Check if there's already a response after this message
    const messagesAfter = session.messages.slice(messageIndex + 1);
    const hasResponse = messagesAfter.some((m) => m.role === "assistant");

    if (hasResponse) {
      console.log("[ChatService] Message already has a response, skipping");
      return;
    }

    // Process the message
    let result;
    try {
      // Get all messages up to (but not including) the pending one
      const messagesUpToPending = session.messages.slice(0, messageIndex);

      result = await this.processMessage(
        {
          id: session.id,
          context: session.context as ChatSessionContext,
          messages: messagesUpToPending,
        },
        userMessageContent
      );
      console.log(
        "[ChatService] Message processed, response length:",
        result.response.length
      );
      console.log(
        "[ChatService] shouldGenerateSchedule:",
        result.shouldGenerateSchedule
      );
    } catch (error) {
      console.error("[ChatService] Error processing message:", error);
      throw error;
    }

    // Store assistant response
    const assistantMessageId = nanoid();
    try {
      await db.insert(chatMessages).values({
        id: assistantMessageId,
        sessionId,
        role: "assistant",
        content: result.response,
        createdAt: new Date(),
      });
      console.log(
        "[ChatService] Assistant message stored:",
        assistantMessageId
      );
    } catch (error) {
      console.error("[ChatService] Error storing assistant message:", error);
      throw error;
    }

    // Update session context
    await db
      .update(chatSessions)
      .set({
        context: result.updatedContext,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    // If schedule should be generated, generate it automatically
    if (result.shouldGenerateSchedule) {
      console.log("=".repeat(80));
      console.log(
        "[ChatService.processExistingMessage] ⚡ shouldGenerateSchedule is TRUE - Starting automatic generation"
      );
      console.log(
        "[ChatService.processExistingMessage] Session ID:",
        sessionId
      );
      console.log(
        "[ChatService.processExistingMessage] User message:",
        userMessageContent.substring(0, 100)
      );
      console.log("=".repeat(80));

      try {
        console.log(
          "[ChatService.processExistingMessage] Step 1: Calling generateSchedule()..."
        );
        const generatedScheduleId = await this.generateSchedule(sessionId);
        console.log(
          "[ChatService.processExistingMessage] ✅ Step 1: Schedule generated successfully!"
        );
        console.log(
          "[ChatService.processExistingMessage] Generated Schedule ID:",
          generatedScheduleId
        );

        // Verify the schedule was created and has xerFileKey
        const createdSchedule = await db.query.schedules.findFirst({
          where: eq(schedules.id, generatedScheduleId),
        });

        if (createdSchedule) {
          console.log(
            "[ChatService.processExistingMessage] Step 2: Verifying schedule creation..."
          );
          console.log("[ChatService.processExistingMessage] Schedule found:", {
            id: createdSchedule.id,
            name: createdSchedule.name,
            xerFileKey: createdSchedule.xerFileKey || "NOT SET",
          });

          if (createdSchedule.xerFileKey) {
            console.log(
              "[ChatService.processExistingMessage] ✅ Step 2: XER file key is set:",
              createdSchedule.xerFileKey
            );
          } else {
            console.error(
              "[ChatService.processExistingMessage] ❌ Step 2: XER file key is NOT set!"
            );
          }
        } else {
          console.error(
            "[ChatService.processExistingMessage] ❌ Step 2: Schedule not found after generation!"
          );
        }

        // Add a message informing the user that the schedule was generated
        const scheduleGeneratedMessage = `✅ Cronograma gerado com sucesso! O arquivo .xer foi criado e está disponível para download na página do cronograma.`;

        console.log(
          "[ChatService.processExistingMessage] Step 3: Adding success message to chat..."
        );
        await db.insert(chatMessages).values({
          id: nanoid(),
          sessionId,
          role: "assistant",
          content: scheduleGeneratedMessage,
          createdAt: new Date(),
        });
        console.log(
          "[ChatService.processExistingMessage] ✅ Step 3: Success message added"
        );
        console.log("=".repeat(80));
      } catch (error) {
        console.error("=".repeat(80));
        console.error(
          "[ChatService.processExistingMessage] ❌ ERROR during automatic schedule generation:"
        );
        console.error(
          "[ChatService.processExistingMessage] Error type:",
          error instanceof Error ? error.constructor.name : typeof error
        );
        console.error(
          "[ChatService.processExistingMessage] Error message:",
          error instanceof Error ? error.message : String(error)
        );
        if (error instanceof Error && error.stack) {
          console.error("[ChatService.processExistingMessage] Stack trace:");
          console.error(error.stack);
        }
        console.error("=".repeat(80));

        // Add error message to chat
        const errorMessage = `⚠️ Ocorreu um erro ao gerar o cronograma. Por favor, tente novamente ou use o botão de geração manual.`;
        await db.insert(chatMessages).values({
          id: nanoid(),
          sessionId,
          role: "assistant",
          content: errorMessage,
          createdAt: new Date(),
        });
      }
    } else {
      console.log(
        "[ChatService.processExistingMessage] shouldGenerateSchedule is FALSE - No automatic generation"
      );
    }

    console.log("[ChatService] Existing message processed successfully");
  }

  /**
   * Process a pending message if one exists
   * This is called when a session is loaded to ensure no messages are left unprocessed
   */
  async processPendingMessage(sessionId: string): Promise<void> {
    try {
      const pendingMessage = await this.checkPendingMessage(sessionId);

      if (pendingMessage) {
        console.log(
          "[ChatService] Found pending message, processing:",
          pendingMessage.id
        );
        // Process the existing message (this will add the assistant response)
        await this.processExistingMessage(
          sessionId,
          pendingMessage.id,
          pendingMessage.content
        );
        console.log("[ChatService] Pending message processed successfully");
      }
    } catch (error) {
      console.error("[ChatService] Error processing pending message:", error);
      // Don't throw - we don't want to block the session load if processing fails
      // The message will be processed on the next attempt
    }
  }

  /**
   * Start a new chat session
   */
  async startSession(options: StartSessionOptions) {
    const { userId, organizationId, projectType, projectDescription } = options;

    console.log("[ChatService] Starting session:", {
      userId,
      organizationId,
      projectType,
      projectDescription,
    });

    const id = nanoid();
    const now = new Date();

    // Generate project name from description (first 50 chars or a default name)
    const projectName =
      projectDescription.length > 50
        ? projectDescription.substring(0, 47) + "..."
        : projectDescription || "Novo Projeto";

    // Create project first
    const projectId = nanoid();
    let createdProject;
    try {
      await db.insert(projects).values({
        id: projectId,
        organizationId,
        name: projectName,
        description: projectDescription,
        type: projectType as any,
        status: "draft",
        createdAt: now,
        updatedAt: now,
      });
      console.log("[ChatService] Project created:", projectId);

      // Verify project was created
      createdProject = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!createdProject) {
        throw new Error("Project was not created successfully");
      }
      console.log(
        "[ChatService] Project verified:",
        createdProject.id,
        createdProject.name
      );
    } catch (error) {
      console.error("[ChatService] Error creating project:", error);
      throw new Error(
        `Failed to create project: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const initialContext: ChatSessionContext = {
      projectType,
      projectDescription,
      currentStep: "initial",
      collectedInfo: {
        projectDescription,
      },
      similarTemplateIds: [],
    };

    try {
      await db.insert(chatSessions).values({
        id,
        userId,
        organizationId,
        projectId: projectId,
        context: initialContext,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      console.log(
        "[ChatService] Session created:",
        id,
        "with projectId:",
        projectId
      );

      // Get initial message
      const initialMessage = await this.getInitialMessage(projectType);
      console.log(
        "[ChatService] Initial message generated:",
        initialMessage.substring(0, 50) + "..."
      );

      // Store initial assistant message
      await db.insert(chatMessages).values({
        id: nanoid(),
        sessionId: id,
        role: "assistant",
        content: initialMessage,
        createdAt: now,
      });

      console.log("[ChatService] Initial message stored");
    } catch (error) {
      console.error("[ChatService] Error creating session:", error);
      // If session creation fails, try to clean up the project
      try {
        await db.delete(projects).where(eq(projects.id, projectId));
        console.log(
          "[ChatService] Cleaned up project after session creation failure"
        );
      } catch (cleanupError) {
        console.error("[ChatService] Error cleaning up project:", cleanupError);
      }
      throw error;
    }

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, id),
      with: {
        messages: true,
        project: true,
      },
    });

    if (!session) {
      throw new Error("Session was not created successfully");
    }

    console.log(
      "[ChatService] Session returned with projectId:",
      session.projectId
    );
    return session;
  }

  /**
   * Get or create a chat session for an existing project
   * Returns the most recent active session for the project, or creates a new one
   */
  async getOrCreateSessionForProject(options: {
    userId: string;
    projectId: string;
  }) {
    const { userId, projectId } = options;

    console.log(
      "[ChatService] Getting or creating session for project:",
      projectId
    );

    // First, verify the project exists and get its details
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new Error("Project not found");
    }

    // Check if user has access to the project's organization
    // (This should be verified at the route level, but we check here too)

    // Look for an existing active session for this project
    // Get all sessions for this project and user, then find the most recent active one
    const allSessions = await db.query.chatSessions.findMany({
      where: eq(chatSessions.projectId, projectId),
      with: {
        messages: {
          orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        },
      },
    });

    // Filter for active sessions by this user and get the most recent
    const activeSessions = allSessions
      .filter((s) => s.status === "active" && s.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const existingSession = activeSessions[0] || null;

    // If there's an active session, return it with properly ordered messages
    if (existingSession) {
      console.log(
        "[ChatService] Found existing active session:",
        existingSession.id
      );
      // Fetch the session again with messages ordered correctly
      const sessionWithMessages = await db.query.chatSessions.findFirst({
        where: eq(chatSessions.id, existingSession.id),
        with: {
          messages: {
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
          },
          project: true,
        },
      });
      return sessionWithMessages || existingSession;
    }

    // Otherwise, create a new session for this project
    console.log("[ChatService] Creating new session for existing project");
    const id = nanoid();
    const now = new Date();

    const initialContext: ChatSessionContext = {
      projectType: project.type || undefined,
      projectDescription: project.description || undefined,
      currentStep: "initial",
      collectedInfo: {
        projectDescription: project.description,
      },
      similarTemplateIds: [],
    };

    // Get initial message for existing project
    const initialMessage = await this.getInitialMessageForExistingProject(
      project.name,
      project.type || undefined
    );

    try {
      await db.insert(chatSessions).values({
        id,
        userId,
        organizationId: project.organizationId,
        projectId: projectId,
        context: initialContext,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      // Store initial assistant message
      await db.insert(chatMessages).values({
        id: nanoid(),
        sessionId: id,
        role: "assistant",
        content: initialMessage,
        createdAt: now,
      });

      console.log(
        "[ChatService] New session created for existing project:",
        id
      );
    } catch (error) {
      console.error(
        "[ChatService] Error creating session for existing project:",
        error
      );
      throw error;
    }

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, id),
      with: {
        messages: true,
        project: true,
      },
    });

    if (!session) {
      throw new Error("Session was not created successfully");
    }

    return session;
  }

  /**
   * Get initial message for an existing project
   */
  async getInitialMessageForExistingProject(
    projectName: string,
    projectType?: string
  ): Promise<string> {
    const typeLabel = projectType
      ? PROJECT_TYPE_LABELS[projectType as keyof typeof PROJECT_TYPE_LABELS]
      : null;

    if (typeLabel) {
      return `Olá! Vou ajudá-lo a modificar e melhorar o cronograma do projeto **${projectName}** (${typeLabel}).\n\nComo posso ajudá-lo hoje? Você pode:\n- Criar um novo cronograma\n- Modificar um cronograma existente\n- Adicionar atividades ou recursos\n- Ajustar prazos ou dependências\n\nO que você gostaria de fazer?`;
    }

    return `Olá! Vou ajudá-lo a modificar e melhorar o cronograma do projeto **${projectName}**.\n\nComo posso ajudá-lo hoje? Você pode:\n- Criar um novo cronograma\n- Modificar um cronograma existente\n- Adicionar atividades ou recursos\n- Ajustar prazos ou dependências\n\nO que você gostaria de fazer?`;
  }

  /**
   * Send a message to a chat session and get AI response
   */
  async sendMessage(sessionId: string, content: string) {
    console.log(
      "[ChatService] Sending message to session:",
      sessionId,
      "Content:",
      content.substring(0, 50) + "..."
    );

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (!session) {
      console.error("[ChatService] Session not found:", sessionId);
      throw new Error("Session not found");
    }

    console.log(
      "[ChatService] Session found, message count:",
      session.messages.length
    );

    const now = new Date();

    // Store user message
    const userMessageId = nanoid();
    try {
      await db.insert(chatMessages).values({
        id: userMessageId,
        sessionId,
        role: "user",
        content,
        createdAt: now,
      });
      console.log("[ChatService] User message stored:", userMessageId);
    } catch (error) {
      console.error("[ChatService] Error storing user message:", error);
      throw error;
    }

    // Process the message
    let result;
    try {
      result = await this.processMessage(
        {
          id: session.id,
          context: session.context as ChatSessionContext,
          messages: session.messages,
        },
        content
      );
      console.log(
        "[ChatService] Message processed, response length:",
        result.response.length
      );
    } catch (error) {
      console.error("[ChatService] Error processing message:", error);
      throw error;
    }

    // Store assistant response
    const assistantMessageId = nanoid();
    try {
      await db.insert(chatMessages).values({
        id: assistantMessageId,
        sessionId,
        role: "assistant",
        content: result.response,
        createdAt: new Date(),
      });
      console.log(
        "[ChatService] Assistant message stored:",
        assistantMessageId
      );
    } catch (error) {
      console.error("[ChatService] Error storing assistant message:", error);
      throw error;
    }

    // Update session context
    await db
      .update(chatSessions)
      .set({
        context: result.updatedContext,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    // If schedule should be generated, generate it automatically
    let generatedScheduleId: string | undefined;
    if (result.shouldGenerateSchedule) {
      console.log("=".repeat(80));
      console.log(
        "[ChatService] ⚡ shouldGenerateSchedule is TRUE - Starting automatic generation"
      );
      console.log("[ChatService] Session ID:", sessionId);
      console.log("[ChatService] User message:", content.substring(0, 100));
      console.log("=".repeat(80));

      try {
        console.log("[ChatService] Step 1: Calling generateSchedule()...");
        generatedScheduleId = await this.generateSchedule(sessionId);
        console.log(
          "[ChatService] ✅ Step 1: Schedule generated successfully!"
        );
        console.log(
          "[ChatService] Generated Schedule ID:",
          generatedScheduleId
        );

        // Verify the schedule was created and has xerFileKey
        const createdSchedule = await db.query.schedules.findFirst({
          where: eq(schedules.id, generatedScheduleId),
        });

        if (createdSchedule) {
          console.log("[ChatService] Step 2: Verifying schedule creation...");
          console.log("[ChatService] Schedule found:", {
            id: createdSchedule.id,
            name: createdSchedule.name,
            xerFileKey: createdSchedule.xerFileKey || "NOT SET",
          });

          if (createdSchedule.xerFileKey) {
            console.log(
              "[ChatService] ✅ Step 2: XER file key is set:",
              createdSchedule.xerFileKey
            );
          } else {
            console.error("[ChatService] ❌ Step 2: XER file key is NOT set!");
          }
        } else {
          console.error(
            "[ChatService] ❌ Step 2: Schedule not found after generation!"
          );
        }

        // Add a message informing the user that the schedule was generated
        const scheduleGeneratedMessage = `✅ Cronograma gerado com sucesso! O arquivo .xer foi criado e está disponível para download na página do cronograma.`;

        console.log("[ChatService] Step 3: Adding success message to chat...");
        await db.insert(chatMessages).values({
          id: nanoid(),
          sessionId,
          role: "assistant",
          content: scheduleGeneratedMessage,
          createdAt: new Date(),
        });
        console.log("[ChatService] ✅ Step 3: Success message added");
        console.log("=".repeat(80));
      } catch (error) {
        console.error("=".repeat(80));
        console.error(
          "[ChatService] ❌ ERROR during automatic schedule generation:"
        );
        console.error(
          "[ChatService] Error type:",
          error instanceof Error ? error.constructor.name : typeof error
        );
        console.error(
          "[ChatService] Error message:",
          error instanceof Error ? error.message : String(error)
        );
        if (error instanceof Error && error.stack) {
          console.error("[ChatService] Stack trace:");
          console.error(error.stack);
        }
        console.error("=".repeat(80));

        // Don't throw - we still want to return the assistant message
        // Add error message to chat
        const errorMessage = `⚠️ Ocorreu um erro ao gerar o cronograma. Por favor, tente novamente ou use o botão de geração manual.`;
        await db.insert(chatMessages).values({
          id: nanoid(),
          sessionId,
          role: "assistant",
          content: errorMessage,
          createdAt: new Date(),
        });
      }
    } else {
      console.log(
        "[ChatService] shouldGenerateSchedule is FALSE - No automatic generation"
      );
    }

    return {
      userMessage: {
        id: userMessageId,
        role: "user",
        content,
        createdAt: now,
      },
      assistantMessage: {
        id: assistantMessageId,
        role: "assistant",
        content: result.response,
        createdAt: new Date(),
      },
      shouldGenerateSchedule: result.shouldGenerateSchedule,
      generatedScheduleId,
    };
  }

  /**
   * Generate a schedule from a chat session
   */
  async generateSchedule(sessionId: string) {
    console.log(
      "[ChatService.generateSchedule] Starting schedule generation for session:",
      sessionId
    );

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
    });

    if (!session) {
      console.error(
        "[ChatService.generateSchedule] Session not found:",
        sessionId
      );
      throw new Error("Session not found");
    }

    console.log("[ChatService.generateSchedule] Session found:", {
      id: session.id,
      projectId: session.projectId,
      userId: session.userId,
      hasContext: !!session.context,
    });

    const context = session.context as ChatSessionContext;
    console.log("[ChatService.generateSchedule] Context:", {
      projectType: context.projectType,
      currentStep: context.currentStep,
      collectedInfoKeys: Object.keys(context.collectedInfo || {}),
    });

    console.log(
      "[ChatService.generateSchedule] Calling generateScheduleFromContext..."
    );
    const scheduleId = await this.generateScheduleFromContext(
      {
        id: session.id,
        projectId: session.projectId,
        userId: session.userId,
      },
      context
    );

    console.log(
      "[ChatService.generateSchedule] Schedule generation completed, ID:",
      scheduleId
    );
    return scheduleId;
  }

  async getInitialMessage(projectType?: string): Promise<string> {
    const typeLabel = projectType
      ? PROJECT_TYPE_LABELS[projectType as keyof typeof PROJECT_TYPE_LABELS]
      : null;

    if (typeLabel) {
      return `Olá! Vou ajudá-lo a criar um cronograma para seu projeto de **${typeLabel}**.\n\nPara começar, poderia me descrever brevemente o escopo do projeto? Por exemplo:\n- Qual é o objetivo principal?\n- Qual a estimativa de duração total?\n- Existem marcos ou entregas importantes?`;
    }

    return `Olá! Sou o assistente de planejamento do Planneer. Vou ajudá-lo a criar um cronograma completo para seu projeto.\n\nPara começar, me conte:\n1. **Que tipo de projeto é?** (construção, manutenção industrial, engenharia, TI, etc.)\n2. **Qual é o objetivo principal do projeto?**`;
  }

  async processMessage(
    session: { id: string; context: ChatSessionContext; messages?: any[] },
    userMessage: string
  ): Promise<{
    response: string;
    updatedContext: ChatSessionContext;
    shouldGenerateSchedule: boolean;
  }> {
    const context = session.context || {};
    let shouldGenerateSchedule = false;

    // Build conversation history
    const history =
      session.messages?.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })) || [];

    // Search for similar templates using RAG
    let similarTemplates: string[] = context.similarTemplateIds || [];
    if (!similarTemplates.length && userMessage.length > 20) {
      const ragResults = await rag.searchSimilarProjects(
        userMessage,
        context.projectType
      );
      similarTemplates = ragResults.map((r) => r.templateId);
    }

    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(context, similarTemplates);

    // Get LLM response
    const originalResponse = await llm.chat([
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ]);

    console.log(
      "[ChatService] LLM response received, length:",
      originalResponse.length
    );

    // Check for generation markers in original response (before removing them)
    const hasGenerationMarker =
      originalResponse.includes("[GERAR]") ||
      originalResponse.includes("[generate]") ||
      originalResponse.includes("[GENERATE]");

    // Remove generation markers from response before showing to user
    let response = originalResponse
      .replace(/\[GERAR\]/gi, "")
      .replace(/\[generate\]/gi, "")
      .replace(/\[GENERATE\]/gi, "")
      .trim();

    // Extract information from user message
    const extractedInfo = await this.extractProjectInfo(userMessage, context);

    // Update context
    const updatedContext: ChatSessionContext = {
      ...context,
      similarTemplateIds: similarTemplates,
      collectedInfo: {
        ...context.collectedInfo,
        ...extractedInfo,
      },
    };

    // Check if we have enough information to generate
    if (this.hasEnoughInfoToGenerate(updatedContext)) {
      // Check for explicit generation requests first (before asking for confirmation)
      const lowerMessage = userMessage.toLowerCase().trim();
      const explicitGenerationKeywords = [
        "gerar",
        "criar",
        "gerar agora",
        "criar agora",
        "gerar o cronograma",
        "criar o cronograma",
        "gerar projeto",
        "criar projeto",
        "gerar arquivo",
        "criar arquivo",
        "gerar .xer",
        "criar .xer",
        "gerar xer",
        "criar xer",
        "pode gerar",
        "pode criar",
        "vamos gerar",
        "vamos criar",
        "faça o cronograma",
        "faça o projeto",
        "faça o arquivo",
      ];

      const isExplicitGenerationRequest = explicitGenerationKeywords.some(
        (keyword) => lowerMessage.includes(keyword)
      );

      // Check for confirmation keywords (more comprehensive)
      const confirmationKeywords = [
        "sim",
        "ok",
        "pode",
        "vamos",
        "vamos lá",
        "confirmo",
        "confirmado",
        "está bom",
        "está ok",
        "tudo certo",
        "prossiga",
        "continue",
        "faça",
        "faça isso",
        "pode fazer",
        "pode prosseguir",
        "pode continuar",
        "está perfeito",
        "está correto",
        "concordo",
        "de acordo",
      ];

      const isConfirmation = confirmationKeywords.some((keyword) =>
        lowerMessage.includes(keyword)
      );

      // Check if the LLM response suggests generation
      const responseLower = response.toLowerCase();

      const responseSuggestsGeneration =
        hasGenerationMarker ||
        responseLower.includes("gerando") ||
        responseLower.includes("vou gerar") ||
        responseLower.includes("estou gerando") ||
        responseLower.includes("gerar agora") ||
        responseLower.includes("criando o cronograma") ||
        responseLower.includes("gerando o cronograma") ||
        responseLower.includes("criando o arquivo") ||
        responseLower.includes("gerando o arquivo") ||
        responseLower.includes("vou criar o cronograma") ||
        responseLower.includes("vou criar o arquivo");

      // If explicit generation request, generate immediately
      if (isExplicitGenerationRequest) {
        shouldGenerateSchedule = true;
        updatedContext.currentStep = "generating";
        console.log(
          "[ChatService] Explicit generation request detected, will generate schedule:",
          {
            userMessage: lowerMessage.substring(0, 50),
          }
        );
      }
      // If we're in confirmation step and user confirms, generate
      else if (context.currentStep?.includes("confirm")) {
        if (isConfirmation || responseSuggestsGeneration) {
          shouldGenerateSchedule = true;
          updatedContext.currentStep = "generating";
          console.log(
            "[ChatService] Confirmation detected, will generate schedule:",
            {
              isConfirmation,
              responseSuggestsGeneration,
              userMessage: lowerMessage.substring(0, 50),
            }
          );
        }
      }
      // If we have enough info but haven't asked for confirmation yet, ask now
      else {
        updatedContext.currentStep = "confirm_generation";
      }
    }

    return {
      response,
      updatedContext,
      shouldGenerateSchedule,
    };
  }

  private buildSystemPrompt(
    context: ChatSessionContext,
    similarTemplateIds: string[]
  ): string {
    let prompt = `Você é um assistente especializado em planejamento de projetos. Seu objetivo é coletar informações necessárias para gerar um cronograma completo.

REGRAS:
1. Faça perguntas específicas e contextuais
2. Seja conciso e profissional
3. Use linguagem em português brasileiro
4. Quando tiver informações suficientes, pergunte se o usuário deseja gerar o cronograma
5. IMPORTANTE: Este sistema exporta cronogramas APENAS no formato .xer (Primavera P6). NUNCA sugira exportação em PDF, Excel, CSV ou outros formatos. Sempre mencione que o cronograma será exportado em formato .xer para importação no Primavera P6.

INFORMAÇÕES COLETADAS:
${JSON.stringify(context.collectedInfo || {}, null, 2)}

INFORMAÇÕES NECESSÁRIAS:
- Tipo de projeto: ${context.projectType || "não informado"}
- Descrição do escopo
- Data de início desejada
- Marcos importantes
- Recursos disponíveis (opcional)
- Restrições e premissas (opcional)

FORMATO DE EXPORTAÇÃO:
- O cronograma gerado será exportado automaticamente em formato .xer (Primavera P6)
- O arquivo .xer será gerado e armazenado automaticamente quando o cronograma for criado
- O usuário poderá baixar o arquivo .xer na página de detalhes do cronograma
- Este é o único formato de exportação disponível no sistema
- O arquivo .xer pode ser importado diretamente no Primavera P6

IMPORTANTE SOBRE GERAÇÃO:
- Quando o usuário confirmar a geração (dizendo "sim", "gerar", "criar", "ok", "pode gerar"), o sistema irá:
  1. Gerar o cronograma completo automaticamente
  2. Criar o arquivo .xer automaticamente
  3. Disponibilizar o arquivo para download na página do cronograma
- NUNCA gere ou mencione links de download na sua resposta - o sistema faz isso automaticamente
- Apenas informe que o cronograma e o arquivo .xer foram gerados com sucesso
- NÃO crie URLs, links ou caminhos de arquivo - isso é feito pelo sistema
- Quando você quiser que o sistema gere o cronograma, use a marcação [GERAR] no final da sua resposta
- Se o usuário pedir explicitamente para gerar, criar ou fazer o cronograma/projeto/arquivo, você deve indicar que vai gerar usando [GERAR]`;

    if (similarTemplateIds.length > 0) {
      prompt += `\n\nTEMPLATES SIMILARES ENCONTRADOS: ${similarTemplateIds.length} projetos similares foram identificados e serão usados como referência.`;
    }

    return prompt;
  }

  private async extractProjectInfo(
    message: string,
    context: ChatSessionContext
  ): Promise<Record<string, unknown>> {
    // Use LLM to extract structured information
    const extractionPrompt = `Extraia informações de planejamento de projeto do seguinte texto. Retorne um JSON com os campos encontrados:
- projectDescription: descrição do projeto
- estimatedDuration: duração estimada
- startDate: data de início
- milestones: marcos importantes (array)
- constraints: restrições
- resources: recursos mencionados

Texto: "${message}"

Contexto atual: ${JSON.stringify(context.collectedInfo || {})}

Retorne APENAS o JSON, sem explicações.`;

    try {
      const response = await llm.chat([
        {
          role: "system",
          content:
            "Você extrai informações estruturadas de texto. Retorne apenas JSON válido.",
        },
        { role: "user", content: extractionPrompt },
      ]);

      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Extraction failed, return empty
    }

    return {};
  }

  private hasEnoughInfoToGenerate(context: ChatSessionContext): boolean {
    const info = context.collectedInfo || {};

    // Minimum required: project type and description
    return !!(
      context.projectType &&
      (info.projectDescription || context.projectDescription)
    );
  }

  private async generateScheduleFromContext(
    session: { id: string; projectId?: string | null; userId: string },
    context: ChatSessionContext
  ): Promise<string> {
    console.log("[ChatService.generateScheduleFromContext] Starting...");
    console.log("[ChatService.generateScheduleFromContext] Session:", {
      id: session.id,
      projectId: session.projectId,
      userId: session.userId,
    });

    const info = context.collectedInfo || {};
    console.log(
      "[ChatService.generateScheduleFromContext] Collected info:",
      Object.keys(info)
    );

    // Get project
    let projectId = session.projectId;

    if (!projectId) {
      console.error("[ChatService.generateScheduleFromContext] No project ID!");
      throw new Error("Project ID is required. Please create a project first.");
    }

    console.log(
      "[ChatService.generateScheduleFromContext] Project ID:",
      projectId
    );

    // Update project with final information if available
    const finalDescription =
      (info.projectDescription as string) || context.projectDescription;
    if (finalDescription) {
      await db
        .update(projects)
        .set({
          description: finalDescription,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));
    }

    // Generate schedule using the scheduler service
    console.log(
      "[ChatService.generateScheduleFromContext] Step 1: Generating schedule data..."
    );
    const scheduleData = await scheduleGenerator.generate({
      projectType: context.projectType || "other",
      description:
        (info.projectDescription as string) || context.projectDescription || "",
      estimatedDuration: info.estimatedDuration as string,
      startDate: info.startDate as string,
      milestones: info.milestones as string[],
      similarTemplateIds: context.similarTemplateIds,
    });
    console.log(
      "[ChatService.generateScheduleFromContext] ✅ Step 1: Schedule data generated:",
      {
        name: scheduleData.name,
        activitiesCount: scheduleData.activities.length,
        wbsCount: scheduleData.wbs.length,
      }
    );

    // Create schedule in database
    const scheduleId = nanoid();
    const now = new Date();
    console.log(
      "[ChatService.generateScheduleFromContext] Step 2: Creating schedule in database, ID:",
      scheduleId
    );

    await db.insert(schedules).values({
      id: scheduleId,
      projectId,
      name: scheduleData.name,
      description: scheduleData.description,
      startDate: scheduleData.startDate,
      endDate: scheduleData.endDate,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });

    // Insert WBS with ID mapping
    console.log(
      "[ChatService.generateScheduleFromContext] Step 3: Inserting WBS items..."
    );
    // Map temporary IDs from ScheduleGenerator to real database IDs
    const wbsIdMap = new Map<string, string>();

    for (const wbsItem of scheduleData.wbs) {
      const realId = nanoid();
      wbsIdMap.set(wbsItem.id, realId);

      // Map parentId to real ID if it exists
      const realParentId = wbsItem.parentId
        ? wbsIdMap.get(wbsItem.parentId) || null
        : null;

      await db.insert(wbs).values({
        id: realId,
        scheduleId,
        parentId: realParentId,
        code: wbsItem.code,
        name: wbsItem.name,
        level: wbsItem.level,
        sortOrder: wbsItem.sortOrder,
        createdAt: now,
      });
    }
    console.log(
      "[ChatService.generateScheduleFromContext] ✅ Step 3: WBS items inserted:",
      scheduleData.wbs.length
    );

    // Insert activities with mapped WBS IDs
    console.log(
      "[ChatService.generateScheduleFromContext] Step 4: Inserting activities..."
    );
    for (const activity of scheduleData.activities) {
      // Map activity.wbsId (temporary ID) to real database ID
      const realWbsId = activity.wbsId
        ? wbsIdMap.get(activity.wbsId) || null
        : null;

      await db.insert(activities).values({
        id: nanoid(),
        scheduleId,
        wbsId: realWbsId,
        code: activity.code,
        name: activity.name,
        description: activity.description,
        duration: activity.duration,
        durationUnit: "days",
        startDate: activity.startDate,
        endDate: activity.endDate,
        percentComplete: 0,
        activityType: activity.type || "task",
        createdAt: now,
        updatedAt: now,
      });
    }
    console.log(
      "[ChatService.generateScheduleFromContext] ✅ Step 4: Activities inserted:",
      scheduleData.activities.length
    );

    // Generate and upload XER file
    console.log(
      "[ChatService.generateScheduleFromContext] Step 5: Starting XER file generation..."
    );
    try {
      // Fetch the complete schedule with all relations needed for XER generation
      console.log(
        "[ChatService.generateScheduleFromContext] Step 5.1: Fetching complete schedule with relations..."
      );
      const completeSchedule = await db.query.schedules.findFirst({
        where: eq(schedules.id, scheduleId),
        with: {
          project: {
            with: { organization: true },
          },
          activities: {
            with: {
              wbs: true,
              predecessors: true,
              resourceAssignments: {
                with: { resource: true },
              },
            },
          },
          wbsItems: true,
        },
      });

      if (!completeSchedule) {
        console.error(
          "[ChatService.generateScheduleFromContext] ❌ Step 5.1: Schedule not found after creation:",
          scheduleId
        );
        return scheduleId;
      }

      console.log(
        "[ChatService.generateScheduleFromContext] ✅ Step 5.1: Schedule found:",
        {
          id: completeSchedule.id,
          name: completeSchedule.name,
          activitiesCount: completeSchedule.activities?.length || 0,
          wbsItemsCount: completeSchedule.wbsItems?.length || 0,
          hasProject: !!completeSchedule.project,
          hasOrganization: !!completeSchedule.project?.organization,
        }
      );

      if (
        !completeSchedule.activities ||
        completeSchedule.activities.length === 0
      ) {
        console.warn(
          "[ChatService.generateScheduleFromContext] ⚠️ Step 5.1: Schedule has no activities, skipping XER generation"
        );
        return scheduleId;
      }

      console.log(
        "[ChatService.generateScheduleFromContext] Step 5.2: Calling generateAndUploadXER()..."
      );
      const xerFileKey = await generateAndUploadXER(completeSchedule as any);
      console.log(
        "[ChatService.generateScheduleFromContext] ✅ Step 5.2: XER file generated and uploaded!"
      );
      console.log(
        "[ChatService.generateScheduleFromContext] XER S3 key:",
        xerFileKey
      );

      console.log(
        "[ChatService.generateScheduleFromContext] Step 5.3: Saving XER file key to schedule..."
      );
      // Update schedule with XER file key
      await db
        .update(schedules)
        .set({
          xerFileKey,
          updatedAt: new Date(),
        })
        .where(eq(schedules.id, scheduleId));

      console.log(
        "[ChatService.generateScheduleFromContext] ✅ Step 5.3: XER file key saved to schedule"
      );
      console.log(
        "[ChatService.generateScheduleFromContext] ✅ Step 5: XER generation completed successfully!"
      );
    } catch (error) {
      console.error("=".repeat(80));
      console.error(
        "[ChatService.generateScheduleFromContext] ❌ ERROR in Step 5 (XER generation):"
      );
      console.error(
        "[ChatService.generateScheduleFromContext] Error type:",
        error instanceof Error ? error.constructor.name : typeof error
      );
      console.error(
        "[ChatService.generateScheduleFromContext] Error message:",
        error instanceof Error ? error.message : String(error)
      );
      if (error instanceof Error && error.stack) {
        console.error("[ChatService.generateScheduleFromContext] Stack trace:");
        console.error(error.stack);
      }
      console.error("=".repeat(80));
      // Don't throw - we don't want to fail schedule creation if XER generation fails
      // The file can be generated later via the export endpoint
    }

    // Update chat session with scheduleId and mark as completed
    await db
      .update(chatSessions)
      .set({
        scheduleId,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, session.id));

    return scheduleId;
  }

  /**
   * Delete all messages after a specific message (by createdAt timestamp)
   */
  async deleteMessagesAfter(sessionId: string, messageCreatedAt: Date) {
    await db
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.sessionId, sessionId),
          gt(chatMessages.createdAt, messageCreatedAt)
        )
      );
  }

  /**
   * Edit a user message and remove all subsequent messages
   */
  async editMessage(sessionId: string, messageId: string, newContent: string) {
    // Get the message to edit
    const message = await db.query.chatMessages.findFirst({
      where: eq(chatMessages.id, messageId),
    });

    if (!message) {
      throw new Error("Message not found");
    }

    if (message.sessionId !== sessionId) {
      throw new Error("Message does not belong to this session");
    }

    if (message.role !== "user") {
      throw new Error("Only user messages can be edited");
    }

    // Update the message content
    await db
      .update(chatMessages)
      .set({ content: newContent })
      .where(eq(chatMessages.id, messageId));

    // Delete all messages after this one
    await this.deleteMessagesAfter(sessionId, message.createdAt);

    // Update session updatedAt
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));

    return {
      message: {
        id: messageId,
        role: "user" as const,
        content: newContent,
        createdAt: message.createdAt,
      },
    };
  }

  /**
   * Resend a message (edit and reprocess) and remove all subsequent messages
   */
  async resendMessage(sessionId: string, messageId: string) {
    // Get the message to resend
    const message = await db.query.chatMessages.findFirst({
      where: eq(chatMessages.id, messageId),
    });

    if (!message) {
      throw new Error("Message not found");
    }

    if (message.sessionId !== sessionId) {
      throw new Error("Message does not belong to this session");
    }

    if (message.role !== "user") {
      throw new Error("Only user messages can be resent");
    }

    // Delete all messages after this one (including any assistant response)
    await this.deleteMessagesAfter(sessionId, message.createdAt);

    // Get the session with remaining messages
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
      with: {
        messages: {
          orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        },
      },
    });

    if (!session) {
      throw new Error("Session not found");
    }

    // Process the message again
    let result;
    try {
      result = await this.processMessage(
        {
          id: session.id,
          context: session.context as ChatSessionContext,
          messages: session.messages,
        },
        message.content
      );
    } catch (error) {
      console.error("[ChatService] Error processing resent message:", error);
      throw error;
    }

    // Store assistant response
    const assistantMessageId = nanoid();
    try {
      await db.insert(chatMessages).values({
        id: assistantMessageId,
        sessionId,
        role: "assistant",
        content: result.response,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("[ChatService] Error storing assistant message:", error);
      throw error;
    }

    // Update session context
    await db
      .update(chatSessions)
      .set({
        context: result.updatedContext,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));

    // If schedule should be generated, generate it automatically
    let generatedScheduleId: string | undefined;
    if (result.shouldGenerateSchedule) {
      console.log("=".repeat(80));
      console.log(
        "[ChatService.resendMessage] ⚡ shouldGenerateSchedule is TRUE - Starting automatic generation"
      );
      console.log("[ChatService.resendMessage] Session ID:", sessionId);
      console.log(
        "[ChatService.resendMessage] User message:",
        message.content.substring(0, 100)
      );
      console.log("=".repeat(80));

      try {
        console.log(
          "[ChatService.resendMessage] Step 1: Calling generateSchedule()..."
        );
        generatedScheduleId = await this.generateSchedule(sessionId);
        console.log(
          "[ChatService.resendMessage] ✅ Step 1: Schedule generated successfully!"
        );
        console.log(
          "[ChatService.resendMessage] Generated Schedule ID:",
          generatedScheduleId
        );

        // Verify the schedule was created and has xerFileKey
        const createdSchedule = await db.query.schedules.findFirst({
          where: eq(schedules.id, generatedScheduleId),
        });

        if (createdSchedule) {
          console.log(
            "[ChatService.resendMessage] Step 2: Verifying schedule creation..."
          );
          console.log("[ChatService.resendMessage] Schedule found:", {
            id: createdSchedule.id,
            name: createdSchedule.name,
            xerFileKey: createdSchedule.xerFileKey || "NOT SET",
          });

          if (createdSchedule.xerFileKey) {
            console.log(
              "[ChatService.resendMessage] ✅ Step 2: XER file key is set:",
              createdSchedule.xerFileKey
            );
          } else {
            console.error(
              "[ChatService.resendMessage] ❌ Step 2: XER file key is NOT set!"
            );
          }
        } else {
          console.error(
            "[ChatService.resendMessage] ❌ Step 2: Schedule not found after generation!"
          );
        }

        // Add a message informing the user that the schedule was generated
        const scheduleGeneratedMessage = `✅ Cronograma gerado com sucesso! O arquivo .xer foi criado e está disponível para download na página do cronograma.`;

        console.log(
          "[ChatService.resendMessage] Step 3: Adding success message to chat..."
        );
        await db.insert(chatMessages).values({
          id: nanoid(),
          sessionId,
          role: "assistant",
          content: scheduleGeneratedMessage,
          createdAt: new Date(),
        });
        console.log(
          "[ChatService.resendMessage] ✅ Step 3: Success message added"
        );
        console.log("=".repeat(80));
      } catch (error) {
        console.error("=".repeat(80));
        console.error(
          "[ChatService.resendMessage] ❌ ERROR during automatic schedule generation:"
        );
        console.error(
          "[ChatService.resendMessage] Error type:",
          error instanceof Error ? error.constructor.name : typeof error
        );
        console.error(
          "[ChatService.resendMessage] Error message:",
          error instanceof Error ? error.message : String(error)
        );
        if (error instanceof Error && error.stack) {
          console.error("[ChatService.resendMessage] Stack trace:");
          console.error(error.stack);
        }
        console.error("=".repeat(80));

        // Don't throw - we still want to return the assistant message
        // Add error message to chat
        const errorMessage = `⚠️ Ocorreu um erro ao gerar o cronograma. Por favor, tente novamente ou use o botão de geração manual.`;
        await db.insert(chatMessages).values({
          id: nanoid(),
          sessionId,
          role: "assistant",
          content: errorMessage,
          createdAt: new Date(),
        });
      }
    } else {
      console.log(
        "[ChatService.resendMessage] shouldGenerateSchedule is FALSE - No automatic generation"
      );
    }

    return {
      userMessage: {
        id: messageId,
        role: "user" as const,
        content: message.content,
        createdAt: message.createdAt,
      },
      assistantMessage: {
        id: assistantMessageId,
        role: "assistant" as const,
        content: result.response,
        createdAt: new Date(),
      },
      shouldGenerateSchedule: result.shouldGenerateSchedule,
      generatedScheduleId,
    };
  }
}
