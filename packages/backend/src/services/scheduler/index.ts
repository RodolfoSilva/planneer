import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { templateActivities, projectTemplates } from '../../db/schema';
import { LLMService } from '../ai/llm';
import { RAGService } from '../ai/rag';
import { addWorkingDays, generateCode } from '@planneer/shared';

const llm = new LLMService();
const rag = new RAGService();

interface GenerateOptions {
  projectType: string;
  description: string;
  estimatedDuration?: string;
  startDate?: string;
  milestones?: string[];
  similarTemplateIds?: string[];
}

interface WBSItem {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  level: number;
  sortOrder: number;
}

interface ActivityItem {
  id: string;
  wbsId: string | null;
  code: string;
  name: string;
  description?: string;
  duration: number;
  startDate?: string;
  endDate?: string;
  type: 'task' | 'milestone' | 'summary';
  predecessors?: string[];
}

interface GeneratedSchedule {
  name: string;
  description: string;
  startDate?: string;
  endDate?: string;
  wbs: WBSItem[];
  activities: ActivityItem[];
}

export class ScheduleGenerator {
  async generate(options: GenerateOptions): Promise<GeneratedSchedule> {
    const { projectType, description, estimatedDuration, startDate, milestones, similarTemplateIds } = options;
    
    // Get context from similar templates
    let templateContext = '';
    if (similarTemplateIds && similarTemplateIds.length > 0) {
      templateContext = await rag.getTemplateContext(similarTemplateIds);
    }
    
    // Get best matching template
    const bestTemplateId = await rag.findBestMatchingTemplate(projectType, description);
    let referenceActivities: any[] = [];
    
    if (bestTemplateId) {
      referenceActivities = await db.query.templateActivities.findMany({
        where: eq(templateActivities.templateId, bestTemplateId),
      });
    }
    
    // Use LLM to generate schedule structure
    const scheduleStructure = await this.generateStructureWithLLM({
      projectType,
      description,
      estimatedDuration,
      milestones,
      templateContext,
      referenceActivities,
    });
    
    // Process and validate the generated schedule
    const processedSchedule = this.processSchedule(scheduleStructure, startDate);
    
    return processedSchedule;
  }
  
  private async generateStructureWithLLM(params: {
    projectType: string;
    description: string;
    estimatedDuration?: string;
    milestones?: string[];
    templateContext: string;
    referenceActivities: any[];
  }): Promise<any> {
    const { projectType, description, estimatedDuration, milestones, templateContext, referenceActivities } = params;
    
    // Build prompt
    let prompt = `Gere um cronograma de projeto estruturado em JSON para:

TIPO DE PROJETO: ${projectType}
DESCRIÇÃO: ${description}
${estimatedDuration ? `DURAÇÃO ESTIMADA: ${estimatedDuration}` : ''}
${milestones?.length ? `MARCOS IMPORTANTES: ${milestones.join(', ')}` : ''}

${templateContext ? `REFERÊNCIA DE PROJETOS SIMILARES:\n${templateContext}\n` : ''}
${referenceActivities.length > 0 ? `ATIVIDADES DE REFERÊNCIA:\n${referenceActivities.slice(0, 20).map(a => `- ${a.code}: ${a.name}`).join('\n')}\n` : ''}

INSTRUÇÕES:
1. Crie uma estrutura WBS hierárquica apropriada
2. Liste atividades com durações realistas (em dias)
3. Defina predecessoras lógicas
4. Inclua marcos nas datas importantes
5. Retorne APENAS JSON válido

FORMATO DO JSON:
{
  "name": "Nome do cronograma",
  "description": "Descrição",
  "wbs": [
    { "code": "1", "name": "Fase 1", "level": 1 },
    { "code": "1.1", "name": "Sub-fase", "level": 2, "parentCode": "1" }
  ],
  "activities": [
    {
      "code": "A1000",
      "name": "Atividade",
      "wbsCode": "1.1",
      "duration": 5,
      "type": "task",
      "predecessors": []
    },
    {
      "code": "A1010",
      "name": "Marco",
      "wbsCode": "1",
      "duration": 0,
      "type": "milestone",
      "predecessors": ["A1000"]
    }
  ]
}`;

    try {
      const response = await llm.chat([
        { 
          role: 'system', 
          content: 'Você é um especialista em planejamento de projetos. Gere cronogramas estruturados e realistas. Retorne APENAS JSON válido, sem markdown ou explicações.' 
        },
        { role: 'user', content: prompt },
      ]);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('LLM schedule generation error:', error);
      
      // Return a default minimal schedule
      return this.generateDefaultSchedule(projectType, description);
    }
  }
  
  private generateDefaultSchedule(projectType: string, description: string): any {
    return {
      name: `Cronograma - ${projectType}`,
      description,
      wbs: [
        { code: '1', name: 'Iniciação', level: 1 },
        { code: '2', name: 'Planejamento', level: 1 },
        { code: '3', name: 'Execução', level: 1 },
        { code: '4', name: 'Encerramento', level: 1 },
      ],
      activities: [
        { code: 'A1000', name: 'Início do Projeto', wbsCode: '1', duration: 0, type: 'milestone', predecessors: [] },
        { code: 'A1010', name: 'Levantamento de Requisitos', wbsCode: '1', duration: 5, type: 'task', predecessors: ['A1000'] },
        { code: 'A1020', name: 'Planejamento Detalhado', wbsCode: '2', duration: 10, type: 'task', predecessors: ['A1010'] },
        { code: 'A1030', name: 'Execução Principal', wbsCode: '3', duration: 20, type: 'task', predecessors: ['A1020'] },
        { code: 'A1040', name: 'Testes e Validação', wbsCode: '3', duration: 10, type: 'task', predecessors: ['A1030'] },
        { code: 'A1050', name: 'Documentação Final', wbsCode: '4', duration: 5, type: 'task', predecessors: ['A1040'] },
        { code: 'A1060', name: 'Fim do Projeto', wbsCode: '4', duration: 0, type: 'milestone', predecessors: ['A1050'] },
      ],
    };
  }
  
  private processSchedule(structure: any, startDateStr?: string): GeneratedSchedule {
    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    
    // Process WBS
    const wbsCodeToId = new Map<string, string>();
    const wbs: WBSItem[] = [];
    
    for (let i = 0; i < (structure.wbs || []).length; i++) {
      const item = structure.wbs[i];
      const id = nanoid();
      wbsCodeToId.set(item.code, id);
      
      const parentId = item.parentCode ? wbsCodeToId.get(item.parentCode) || null : null;
      
      wbs.push({
        id,
        parentId,
        code: item.code,
        name: item.name,
        level: item.level || 1,
        sortOrder: i,
      });
    }
    
    // Process activities
    const activityCodeToId = new Map<string, string>();
    const activityDates = new Map<string, { start: Date; end: Date }>();
    const activities: ActivityItem[] = [];
    
    // First pass: create activities and assign IDs
    for (const act of (structure.activities || [])) {
      const id = nanoid();
      activityCodeToId.set(act.code, id);
      
      activities.push({
        id,
        wbsId: act.wbsCode ? wbsCodeToId.get(act.wbsCode) || null : null,
        code: act.code,
        name: act.name,
        description: act.description,
        duration: act.duration || 0,
        type: act.type || 'task',
        predecessors: act.predecessors || [],
      });
    }
    
    // Second pass: calculate dates based on predecessors (forward pass)
    for (const activity of activities) {
      let activityStart = new Date(startDate);
      
      // Find latest predecessor end date
      if (activity.predecessors && activity.predecessors.length > 0) {
        for (const predCode of activity.predecessors) {
          const predDates = activityDates.get(predCode);
          if (predDates && predDates.end > activityStart) {
            activityStart = new Date(predDates.end);
            activityStart.setDate(activityStart.getDate() + 1); // Next day
          }
        }
      }
      
      const activityEnd = activity.duration > 0
        ? addWorkingDays(activityStart, activity.duration)
        : activityStart;
      
      activityDates.set(activity.code, { start: activityStart, end: activityEnd });
      
      activity.startDate = activityStart.toISOString().split('T')[0];
      activity.endDate = activityEnd.toISOString().split('T')[0];
    }
    
    // Calculate schedule end date
    let scheduleEnd = startDate;
    for (const dates of activityDates.values()) {
      if (dates.end > scheduleEnd) {
        scheduleEnd = dates.end;
      }
    }
    
    return {
      name: structure.name || 'Generated Schedule',
      description: structure.description || '',
      startDate: startDate.toISOString().split('T')[0],
      endDate: scheduleEnd.toISOString().split('T')[0],
      wbs,
      activities,
    };
  }
}



