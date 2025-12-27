import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  chatSessions,
  chatMessages,
  schedules,
  activities,
  wbs,
  type ChatSessionContext,
} from "../../db/schema";
import { LLMService } from "../ai/llm";
import { RAGService } from "../ai/rag";
import { ScheduleGenerator } from "../scheduler";
import { PROJECT_TYPE_LABELS } from "@planneer/shared";

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
   * Start a new chat session
   */
  async startSession(options: StartSessionOptions) {
    const { userId, organizationId, projectType, projectDescription } = options;

    console.log("[ChatService] Starting session:", { userId, organizationId, projectType });

    const id = nanoid();
    const now = new Date();

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
        projectId: null,
        context: initialContext,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      console.log("[ChatService] Session created:", id);

      // Get initial message
      const initialMessage = await this.getInitialMessage(projectType);
      console.log("[ChatService] Initial message generated:", initialMessage.substring(0, 50) + "...");

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
      throw error;
    }

    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, id),
      with: {
        messages: true,
      },
    });

    return session;
  }

  /**
   * Send a message to a chat session and get AI response
   */
  async sendMessage(sessionId: string, content: string) {
    console.log("[ChatService] Sending message to session:", sessionId, "Content:", content.substring(0, 50) + "...");

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

    console.log("[ChatService] Session found, message count:", session.messages.length);

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
      console.log("[ChatService] Message processed, response length:", result.response.length);
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
      console.log("[ChatService] Assistant message stored:", assistantMessageId);
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
    };
  }

  /**
   * Generate a schedule from a chat session
   */
  async generateSchedule(sessionId: string) {
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
    });

    if (!session) {
      throw new Error("Session not found");
    }

    const context = session.context as ChatSessionContext;

    return this.generateScheduleFromContext(
      {
        id: session.id,
        projectId: session.projectId,
        userId: session.userId,
      },
      context
    );
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
    const response = await llm.chat([
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage },
    ]);

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
      // Ask for confirmation before generating
      if (!context.currentStep?.includes("confirm")) {
        updatedContext.currentStep = "confirm_generation";
      } else if (
        userMessage.toLowerCase().includes("sim") ||
        userMessage.toLowerCase().includes("gerar") ||
        userMessage.toLowerCase().includes("criar")
      ) {
        shouldGenerateSchedule = true;
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

INFORMAÇÕES COLETADAS:
${JSON.stringify(context.collectedInfo || {}, null, 2)}

INFORMAÇÕES NECESSÁRIAS:
- Tipo de projeto: ${context.projectType || "não informado"}
- Descrição do escopo
- Data de início desejada
- Marcos importantes
- Recursos disponíveis (opcional)
- Restrições e premissas (opcional)`;

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
    const info = context.collectedInfo || {};

    // Create or get project
    let projectId = session.projectId;

    if (!projectId) {
      // Would need to create a project and organization
      // For now, we'll throw an error
      throw new Error("Project ID is required. Please create a project first.");
    }

    // Generate schedule using the scheduler service
    const scheduleData = await scheduleGenerator.generate({
      projectType: context.projectType || "other",
      description:
        (info.projectDescription as string) ||
        context.projectDescription ||
        "",
      estimatedDuration: info.estimatedDuration as string,
      startDate: info.startDate as string,
      milestones: info.milestones as string[],
      similarTemplateIds: context.similarTemplateIds,
    });

    // Create schedule in database
    const scheduleId = nanoid();
    const now = new Date();

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

    // Insert WBS
    for (const wbsItem of scheduleData.wbs) {
      await db.insert(wbs).values({
        id: nanoid(),
        scheduleId,
        parentId: wbsItem.parentId,
        code: wbsItem.code,
        name: wbsItem.name,
        level: wbsItem.level,
        sortOrder: wbsItem.sortOrder,
        createdAt: now,
      });
    }

    // Insert activities
    for (const activity of scheduleData.activities) {
      await db.insert(activities).values({
        id: nanoid(),
        scheduleId,
        wbsId: activity.wbsId,
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

    return scheduleId;
  }
}
