import { eq, sql, desc } from 'drizzle-orm';
import { db } from '../../db';
import { templateEmbeddings, projectTemplates } from '../../db/schema';
import { LLMService } from './llm';

const llm = new LLMService();

interface RAGResult {
  templateId: string;
  templateName: string;
  chunkType: string;
  content: string;
  similarity: number;
}

export class RAGService {
  async searchSimilarProjects(
    query: string,
    projectType?: string,
    limit: number = 5
  ): Promise<RAGResult[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await llm.generateEmbedding(query);
      
      // Search for similar embeddings using pgvector
      const results = await db
        .select({
          id: templateEmbeddings.id,
          templateId: templateEmbeddings.templateId,
          chunkType: templateEmbeddings.chunkType,
          content: templateEmbeddings.content,
          similarity: sql<number>`1 - (${templateEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
        })
        .from(templateEmbeddings)
        .orderBy(sql`${templateEmbeddings.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
        .limit(limit * 2); // Get more to filter by type
      
      // Get template details
      const templateIds = [...new Set(results.map(r => r.templateId))];
      const templates = await db.query.projectTemplates.findMany({
        where: (t, { inArray }) => inArray(t.id, templateIds),
      });
      
      const templateMap = new Map(templates.map(t => [t.id, t]));
      
      // Filter by project type if specified
      let filtered = results;
      if (projectType) {
        filtered = results.filter(r => {
          const template = templateMap.get(r.templateId);
          return template?.type === projectType;
        });
      }
      
      // Return top results with template info
      return filtered.slice(0, limit).map(r => ({
        templateId: r.templateId,
        templateName: templateMap.get(r.templateId)?.name || '',
        chunkType: r.chunkType,
        content: r.content,
        similarity: r.similarity,
      }));
    } catch (error) {
      console.error('RAG search error:', error);
      return [];
    }
  }
  
  async getTemplateContext(templateIds: string[]): Promise<string> {
    if (templateIds.length === 0) return '';
    
    const templates = await db.query.projectTemplates.findMany({
      where: (t, { inArray }) => inArray(t.id, templateIds),
    });
    
    // Get template activities
    const activities = await db.query.templateActivities.findMany({
      where: (a, { inArray }) => inArray(a.templateId, templateIds),
    });
    
    // Build context string
    let context = 'PROJETOS SIMILARES PARA REFERÊNCIA:\n\n';
    
    for (const template of templates) {
      const templateActivities = activities.filter(a => a.templateId === template.id);
      
      context += `## ${template.name}\n`;
      context += `Tipo: ${template.type}\n`;
      context += `Atividades: ${templateActivities.length}\n`;
      
      if (template.description) {
        context += `Descrição: ${template.description}\n`;
      }
      
      // Include sample activities
      const sampleActivities = templateActivities.slice(0, 10);
      if (sampleActivities.length > 0) {
        context += 'Atividades principais:\n';
        for (const activity of sampleActivities) {
          context += `- ${activity.code}: ${activity.name}`;
          if (activity.duration) {
            context += ` (${activity.duration} ${activity.durationUnit || 'dias'})`;
          }
          context += '\n';
        }
      }
      
      context += '\n';
    }
    
    return context;
  }
  
  async findBestMatchingTemplate(
    projectType: string,
    description: string
  ): Promise<string | null> {
    const results = await this.searchSimilarProjects(
      `${projectType}: ${description}`,
      projectType,
      1
    );
    
    return results[0]?.templateId || null;
  }
}




