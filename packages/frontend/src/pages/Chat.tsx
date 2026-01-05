import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  Send,
  Sparkles,
  Calendar,
  ArrowRight,
  Loader2,
  Download,
} from "lucide-react";
import { chat, schedules } from "@/lib/api";
import { ChatMessage, TypingIndicator } from "@/components/ChatMessage";
import { cn } from "@/lib/utils";
import { PROJECT_TYPE_LABELS } from "@planneer/shared";
import { useOrganization } from "@/hooks/useOrganization";

const projectTypes = Object.entries(PROJECT_TYPE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  })
);

export function Chat() {
  const { sessionId } = useParams({ strict: false });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentOrganization, isLoading: isOrgLoading } = useOrganization();

  // Debug: log organization state
  console.log(
    "[Chat] Organization:",
    currentOrganization,
    "Loading:",
    isOrgLoading
  );

  const [input, setInput] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<
    Array<{ id: string; role: "user"; content: string; createdAt: string }>
  >([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch session if we have an ID
  const sessionQuery = useQuery({
    queryKey: ["chat-session", sessionId],
    queryFn: () => chat.getSession(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      // If there's a pending user message (last message is from user),
      // refetch more frequently to get the assistant response
      const messages = query.state.data?.data?.messages || [];
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.role === "user") {
          // Refetch every 2 seconds if there's a pending message
          return 2000;
        }
      }
      // Otherwise, don't auto-refetch
      return false;
    },
  });

  // Start session mutation
  const startSessionMutation = useMutation({
    mutationFn: (data: {
      organizationId: string;
      projectType: string;
      projectName: string;
    }) => chat.startSession(data),
    onSuccess: (data) => {
      // Invalidate projects query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      console.log("[Chat] Session started, projectId:", data.data.projectId);
      navigate({ to: `/chat/${data.data.id}` });
    },
    onError: (err: Error) => {
      console.error("[Chat] Error starting session:", err);
      setError(err.message || "Erro ao iniciar conversa");
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => chat.sendMessage(sessionId!, content),
    onMutate: (content: string) => {
      setIsTyping(true);
      setError(null);

      // Add optimistic message immediately
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        role: "user" as const,
        content: content,
        createdAt: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, optimisticMessage]);
    },
    onSuccess: () => {
      setIsTyping(false);
      // Clear optimistic messages as server will return the real ones
      setOptimisticMessages([]);
      queryClient.invalidateQueries({ queryKey: ["chat-session", sessionId] });

      // Return focus to input after message is sent
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    },
    onError: (err: Error) => {
      setIsTyping(false);
      // Remove the failed optimistic message
      setOptimisticMessages([]);
      setError(err.message || "Erro ao enviar mensagem. Tente novamente.");
      console.error("[Chat] Error sending message:", err);
    },
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: ({
      messageId,
      content,
    }: {
      messageId: string;
      content: string;
    }) => chat.editMessage(sessionId!, messageId, content),
    onMutate: () => {
      setError(null);
    },
    onSuccess: () => {
      setEditingMessageId(null);
      queryClient.invalidateQueries({ queryKey: ["chat-session", sessionId] });
      // Clear optimistic messages as they will be replaced by server response
      setOptimisticMessages([]);
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao editar mensagem. Tente novamente.");
      console.error("[Chat] Error editing message:", err);
    },
  });

  // Resend message mutation
  const resendMessageMutation = useMutation({
    mutationFn: (messageId: string) =>
      chat.resendMessage(sessionId!, messageId),
    onMutate: async (messageId: string) => {
      setIsTyping(true);
      setError(null);

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: ["chat-session", sessionId],
      });

      // Snapshot the previous value
      const previousSession = queryClient.getQueryData<{
        success: boolean;
        data: { messages: any[] };
      }>(["chat-session", sessionId]);

      // Optimistically remove all messages after the one being resent
      if (previousSession?.data?.messages) {
        const messageIndex = previousSession.data.messages.findIndex(
          (m: any) => m.id === messageId
        );

        if (messageIndex !== -1) {
          // Remove all messages after this one
          const updatedMessages = previousSession.data.messages.slice(
            0,
            messageIndex + 1
          );

          // Update the cache immediately
          queryClient.setQueryData(["chat-session", sessionId], {
            ...previousSession,
            data: {
              ...previousSession.data,
              messages: updatedMessages,
            },
          });
        }
      }

      // Also clear any optimistic messages that might be after this one
      // Since we're removing all messages after the resent one, clear all optimistic messages
      setOptimisticMessages([]);

      return { previousSession };
    },
    onSuccess: (data) => {
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ["chat-session", sessionId] });

      // If schedule was generated, show it
      if (data.data.shouldGenerateSchedule) {
        // The schedule generation will be handled by the backend
        queryClient.invalidateQueries({ queryKey: ["schedule"] });
      }
    },
    onError: (err: Error, _messageId: string, context) => {
      setIsTyping(false);

      // Rollback to previous state on error
      if (context?.previousSession) {
        queryClient.setQueryData(
          ["chat-session", sessionId],
          context.previousSession
        );
      }

      setError(err.message || "Erro ao reenviar mensagem. Tente novamente.");
      console.error("[Chat] Error resending message:", err);
    },
  });

  const serverMessages = sessionQuery.data?.data?.messages || [];
  const scheduleId = sessionQuery.data?.data?.scheduleId;

  // Fetch schedule if it exists
  const scheduleQuery = useQuery({
    queryKey: ["schedule", scheduleId],
    queryFn: () => schedules.get(scheduleId!),
    enabled: !!scheduleId,
  });

  const schedule = scheduleQuery.data?.data;

  // Download XER mutation
  const downloadXerMutation = useMutation({
    mutationFn: () => schedules.downloadXer(scheduleId!),
    onSuccess: (data) => {
      // Open download URL in new tab
      window.open(data.data.downloadUrl, "_blank");
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao baixar arquivo .xer");
    },
  });

  // Combine server messages with optimistic messages
  // Optimistic messages are temporary and will be replaced by server response
  const messages = [...serverMessages, ...optimisticMessages];

  // Clear optimistic messages when server messages are updated
  // This prevents duplicates if the query refetches quickly
  useEffect(() => {
    if (serverMessages.length > 0 && optimisticMessages.length > 0) {
      // Check if the last server message matches any optimistic message
      const lastServerMessage = serverMessages[serverMessages.length - 1];
      const hasMatchingMessage = optimisticMessages.some(
        (optMsg) =>
          optMsg.content === lastServerMessage.content &&
          lastServerMessage.role === "user"
      );

      if (hasMatchingMessage) {
        setOptimisticMessages([]);
      }
    }
  }, [serverMessages, optimisticMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input
  useEffect(() => {
    if (sessionId) {
      inputRef.current?.focus();
    }
  }, [sessionId]);

  const handleStartChat = () => {
    setError(null);

    console.log("[Chat] handleStartChat called");
    console.log("[Chat] currentOrganization:", currentOrganization);
    console.log("[Chat] selectedType:", selectedType);
    console.log("[Chat] projectName:", projectName);

    if (!currentOrganization?.id) {
      setError("Organização não encontrada. Recarregue a página.");
      console.error("[Chat] No organization ID!");
      return;
    }

    if (!selectedType) {
      setError("Selecione um tipo de projeto");
      return;
    }

    if (!projectName.trim() || projectName.trim().length < 3) {
      setError("Digite o nome do projeto (mínimo 3 caracteres)");
      return;
    }

    const payload = {
      organizationId: currentOrganization.id,
      projectType: selectedType,
      projectName: projectName.trim(),
    };

    console.log("[Chat] Sending payload:", payload);
    startSessionMutation.mutate(payload);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !sessionId || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate(input.trim());
    setInput("");

    // Return focus to input after sending
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
      // Return focus to input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleStartEdit = (messageId: string) => {
    setEditingMessageId(messageId);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
  };

  const handleEditMessage = (messageId: string, content: string) => {
    if (
      content.trim() &&
      content !== serverMessages.find((m: any) => m.id === messageId)?.content
    ) {
      editMessageMutation.mutate({ messageId, content });
    } else {
      setEditingMessageId(null);
    }
  };

  const handleResendMessage = (messageId: string) => {
    resendMessageMutation.mutate(messageId);
  };

  // Initial screen - no session
  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-10 h-10 text-white" />
            </div>

            <h1 className="text-3xl font-display font-bold text-slate-900 mb-3">
              Criar Novo Cronograma
            </h1>
            <p className="text-lg text-slate-600">
              Selecione o tipo de projeto e informe o nome. A IA vai coletar os
              detalhes através de uma conversa.
            </p>
          </div>

          {/* Loading organization */}
          {isOrgLoading && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando organização...
            </div>
          )}

          {/* Organization info */}
          {currentOrganization && (
            <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
              Organização: <strong>{currentOrganization.name}</strong>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Project Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              1. Tipo de Projeto
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {projectTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    selectedType === type.value
                      ? "border-primary-500 bg-primary-50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm font-medium",
                      selectedType === type.value
                        ? "text-primary-700"
                        : "text-slate-700"
                    )}
                  >
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Project Name */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-slate-700 mb-3">
              2. Nome do Projeto
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ex: Construção Edifício Residencial Centro"
              className="input"
            />
            <p className="text-xs text-slate-500 mt-2">
              Digite um nome descritivo para o projeto. A descrição detalhada
              será coletada pela IA durante a conversa.
            </p>
          </div>

          <div className="text-center">
            <button
              onClick={handleStartChat}
              disabled={
                startSessionMutation.isPending ||
                isOrgLoading ||
                !currentOrganization
              }
              className="btn-primary text-lg px-8 py-3"
            >
              {startSessionMutation.isPending || isOrgLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-5 h-5 mr-2" />
              )}
              {isOrgLoading ? "Carregando..." : "Iniciar Conversa com IA"}
            </button>

            {!isOrgLoading && !currentOrganization && (
              <p className="mt-4 text-sm text-red-600">
                Organização não encontrada. Por favor, recarregue a página.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="flex flex-col h-screen lg:h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">
              Assistente de Planejamento
            </h1>
            <p className="text-sm text-slate-500">
              Criando seu cronograma com IA
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sessionQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : (
          <>
            {messages.map((message: any) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.createdAt}
                messageId={message.id}
                onEdit={handleEditMessage}
                onResend={handleResendMessage}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                isEditing={editingMessageId === message.id}
              />
            ))}

            {isTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-white">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-3 items-stretch">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva seu projeto ou responda às perguntas da IA..."
              className="input resize-none pr-12 select-text min-h-[42px]"
              rows={1}
              disabled={
                sendMessageMutation.isPending ||
                sessionQuery.data?.data?.status !== "active"
              }
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || sendMessageMutation.isPending}
            className="btn-primary self-stretch px-4 min-h-[42px]"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>

        {sessionQuery.data?.data?.status === "completed" && (
          <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-emerald-700 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Cronograma gerado com sucesso!
              </p>
              <div className="flex items-center gap-2">
                {schedule?.xerFileKey && (
                  <button
                    onClick={() => downloadXerMutation.mutate()}
                    disabled={downloadXerMutation.isPending}
                    className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
                  >
                    {downloadXerMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Baixar .xer
                  </button>
                )}
                {scheduleId && (
                  <button
                    onClick={() =>
                      navigate({
                        to: `/schedules/${scheduleId}`,
                      })
                    }
                    className="text-sm text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-emerald-100 transition-colors"
                  >
                    Ver cronograma <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
