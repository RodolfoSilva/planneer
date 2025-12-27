import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import {
  templateEmbeddings,
  projectTemplates,
  templateActivities,
} from "../../db/schema";
import { LLMService } from "./llm";
import { chunkArray } from "@planneer/shared";

const llm = new LLMService();

interface EmbeddingChunk {
  type: string;
  index: number;
  content: string;
}

export async function generateTemplateEmbeddings(
  templateId: string
): Promise<void> {
  // Get template data
  const template = await db.query.projectTemplates.findFirst({
    where: eq(projectTemplates.id, templateId),
  });

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  // Get template activities
  const activities = await db.query.templateActivities.findMany({
    where: eq(templateActivities.templateId, templateId),
  });

  // Delete existing embeddings
  await db
    .delete(templateEmbeddings)
    .where(eq(templateEmbeddings.templateId, templateId));

  // Create chunks for embedding
  const chunks: EmbeddingChunk[] = [];

  // Full template description
  if (template.description) {
    chunks.push({
      type: "description",
      index: 0,
      content: `Projeto: ${template.name}\nTipo: ${template.type}\nDescrição: ${template.description}`,
    });
  }

  // Activities in batches (max ~500 tokens per chunk)
  const activityBatches = chunkArray(activities, 20);

  for (let i = 0; i < activityBatches.length; i++) {
    const batch = activityBatches[i];
    const content = batch
      .map((a) => {
        let line = `${a.code}: ${a.name}`;
        if (a.duration) line += ` (${a.duration} ${a.durationUnit || "dias"})`;
        if (a.wbsPath) line += ` [WBS: ${a.wbsPath}]`;
        return line;
      })
      .join("\n");

    chunks.push({
      type: "activities",
      index: i,
      content: `Atividades do projeto ${template.name}:\n${content}`,
    });
  }

  // WBS structure (extract from activities)
  const wbsPaths = [
    ...new Set(activities.map((a) => a.wbsPath).filter(Boolean)),
  ];
  if (wbsPaths.length > 0) {
    chunks.push({
      type: "wbs",
      index: 0,
      content: `Estrutura WBS do projeto ${template.name}:\n${wbsPaths.join(
        "\n"
      )}`,
    });
  }

  // Generate embeddings
  const contents = chunks.map((c) => c.content);
  const embeddings = await llm.generateEmbeddings(contents);

  // Store embeddings
  const now = new Date();
  const values = chunks.map((chunk, i) => ({
    id: nanoid(),
    templateId,
    chunkType: chunk.type,
    chunkIndex: String(chunk.index),
    content: chunk.content,
    embedding: embeddings[i],
    createdAt: now,
  }));

  if (values.length > 0) {
    await db.insert(templateEmbeddings).values(values);
  }

  console.log(
    `Generated ${values.length} embeddings for template ${templateId}`
  );
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddings = await llm.generateEmbeddings([text]);
  return embeddings[0];
}

export async function regenerateAllEmbeddings(): Promise<void> {
  const templates = await db.query.projectTemplates.findMany();

  console.log(`Regenerating embeddings for ${templates.length} templates...`);

  for (const template of templates) {
    try {
      await generateTemplateEmbeddings(template.id);
    } catch (error) {
      console.error(
        `Failed to generate embeddings for template ${template.id}:`,
        error
      );
    }
  }

  console.log("Embedding regeneration complete");
}
