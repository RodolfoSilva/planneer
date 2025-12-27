import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { ChatService } from "../services/chat";
import { auth } from "../auth";

interface Connection {
  userId: string;
  sessionId?: string;
  send: (data: any) => void;
}

const connections = new Map<string, Connection>();
const chatService = new ChatService();

export const websocketRoutes = new Elysia({ prefix: "/ws" }).ws("/chat", {
  open(ws) {
    const connectionId = nanoid();
    (ws.data as any).connectionId = connectionId;
    console.log(`WebSocket connected: ${connectionId}`);
  },

  async message(ws, message: any) {
    const connectionId = (ws.data as any).connectionId;
    const conn = connections.get(connectionId);

    try {
      const data = typeof message === "string" ? JSON.parse(message) : message;

      switch (data.type) {
        case "auth":
          // Validate the session token instead of trusting userId from client
          if (!data.token) {
            ws.send(
              JSON.stringify({
                type: "auth_error",
                message: "Authentication token required",
              })
            );
            return;
          }

          try {
            // Create a mock request with the token to validate session
            const headers = new Headers();
            headers.set("Cookie", `planneer.session_token=${data.token}`);

            const session = await auth.api.getSession({
              headers,
            });

            if (!session?.user) {
              ws.send(
                JSON.stringify({
                  type: "auth_error",
                  message: "Invalid or expired session",
                })
              );
              return;
            }

            // Store the verified user connection
            connections.set(connectionId, {
              userId: session.user.id,
              send: (msg) => ws.send(JSON.stringify(msg)),
            });

            ws.send(
              JSON.stringify({
                type: "auth_success",
                connectionId,
                userId: session.user.id,
              })
            );
          } catch (error: any) {
            console.error("WebSocket auth error:", error);
            ws.send(
              JSON.stringify({
                type: "auth_error",
                message: "Authentication failed",
              })
            );
          }
          break;

        case "join_session":
          if (!conn) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Not authenticated",
              })
            );
            return;
          }

          // Verify user has access to the session
          try {
            const chatSession = await chatService.getSession(data.sessionId);

            if (!chatSession) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Session not found",
                })
              );
              return;
            }

            if (chatSession.userId !== conn.userId) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "You do not have access to this session",
                })
              );
              return;
            }

            conn.sessionId = data.sessionId;
            ws.send(
              JSON.stringify({
                type: "session_joined",
                sessionId: data.sessionId,
              })
            );
          } catch (error: any) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: error.message || "Failed to join session",
              })
            );
          }
          break;

        case "message":
          if (!conn || !conn.sessionId) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Not in a session",
              })
            );
            return;
          }

          ws.send(
            JSON.stringify({
              type: "message_received",
              status: "processing",
            })
          );

          try {
            const response = await chatService.sendMessage(
              conn.sessionId,
              data.content
            );

            ws.send(
              JSON.stringify({
                type: "assistant_message",
                ...response,
              })
            );
          } catch (error: any) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: error.message || "Failed to process message",
              })
            );
          }
          break;

        case "generate_schedule":
          if (!conn || !conn.sessionId) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Not in a session",
              })
            );
            return;
          }

          ws.send(
            JSON.stringify({
              type: "generation_started",
              status: "generating",
            })
          );

          try {
            const schedule = await chatService.generateSchedule(conn.sessionId);

            ws.send(
              JSON.stringify({
                type: "schedule_generated",
                schedule,
              })
            );
          } catch (error: any) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: error.message || "Failed to generate schedule",
              })
            );
          }
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;

        default:
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Unknown message type: ${data.type}`,
            })
          );
      }
    } catch (error: any) {
      ws.send(
        JSON.stringify({
          type: "error",
          message: error.message || "Invalid message format",
        })
      );
    }
  },

  close(ws) {
    const connectionId = (ws.data as any).connectionId;
    connections.delete(connectionId);
    console.log(`WebSocket disconnected: ${connectionId}`);
  },
});

export { connections };
