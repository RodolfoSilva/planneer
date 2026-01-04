---
description: "Patterns for AI services including LLM integration, embeddings, RAG, and chat functionality"
globs:
  - "packages/backend/src/services/ai/**/*.ts"
  - "packages/backend/src/services/chat/**/*.ts"
  - "packages/backend/src/services/rag/**/*.ts"
alwaysApply: false
---

# AI Services Patterns

## LLM Service

When working with LLM services in `packages/backend/src/services/ai/llm.ts`:

- Support multiple providers (OpenAI primary, Anthropic fallback)
- Implement automatic fallback on errors
- Use streaming for long responses when possible
- Handle rate limiting and retries gracefully

Example pattern:

```typescript
import { OpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";

async function generateWithFallback(prompt: string) {
  try {
    // Try OpenAI first
    return await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    });
  } catch (error) {
    // Fallback to Anthropic
    return await anthropic.messages.create({
      model: "claude-3-opus",
      messages: [{ role: "user", content: prompt }],
    });
  }
}
```

## Embeddings Service

When working with embeddings in `packages/backend/src/services/ai/embeddings.ts`:

- Use OpenAI's `text-embedding-ada-002` model (1536 dimensions)
- Store embeddings in pgvector with proper dimensions
- Batch embedding generation for efficiency
- Cache embeddings when possible

Example:

```typescript
import { OpenAI } from "openai";

const openai = new OpenAI();

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  
  return response.data[0].embedding;
}
```

## RAG (Retrieval Augmented Generation)

When implementing RAG in `packages/backend/src/services/ai/rag.ts`:

- Use pgvector for similarity search
- Retrieve top-k most similar documents
- Include context in LLM prompts
- Use cosine similarity for vector search

Example:

```typescript
import { sql } from "drizzle-orm";
import { db } from "../db";
import { embeddings } from "../db/schema";

export async function findSimilarProjects(
  queryEmbedding: number[],
  limit: number = 5
) {
  const results = await db
    .select()
    .from(embeddings)
    .orderBy(
      sql`${embeddings.embedding} <=> ${sql.raw(`'[${queryEmbedding.join(",")}]'`)}::vector`
    )
    .limit(limit);
    
  return results;
}
```

## Chat Service

When working with chat functionality in `packages/backend/src/services/chat/`:

- Maintain conversation context across messages
- Use system prompts for role definition
- Implement message history management
- Support streaming responses via WebSocket
- Store chat sessions in database for persistence

Example structure:

```typescript
export class ChatService {
  async sendMessage(sessionId: string, content: string) {
    // 1. Retrieve session and history
    const session = await getChatSession(sessionId);
    const history = await getMessageHistory(sessionId);
    
    // 2. Retrieve relevant context using RAG
    const context = await retrieveContext(content, session.projectType);
    
    // 3. Build prompt with context
    const prompt = buildPrompt(content, context, history);
    
    // 4. Generate response
    const response = await generateWithFallback(prompt);
    
    // 5. Store message
    await storeMessage(sessionId, content, response);
    
    return response;
  }
}
```

## Prompt Engineering

- Use clear, structured system prompts
- Include relevant context from RAG results
- Maintain conversation history in prompts
- Use few-shot examples when helpful
- Format prompts consistently

Example prompt structure:

```typescript
const systemPrompt = `You are an expert project scheduler assistant.
Your role is to help users create project schedules by:
1. Understanding project requirements
2. Suggesting activities based on similar projects
3. Asking clarifying questions
4. Generating complete schedules

Use the following context from similar projects:
${context}

Previous conversation:
${history}
`;
```

## Error Handling

- Handle API rate limits gracefully
- Implement exponential backoff for retries
- Log errors for debugging
- Provide fallback responses when AI services fail
- Monitor token usage and costs

## Streaming

- Use streaming for long responses
- Implement WebSocket support for real-time updates
- Send partial responses as they're generated
- Handle connection errors gracefully

## Cost Optimization

- Cache embeddings for repeated content
- Use appropriate model sizes (smaller for simple tasks)
- Batch requests when possible
- Monitor and log token usage
- Set reasonable limits on response lengths

