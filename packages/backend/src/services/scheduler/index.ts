import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { templateActivities, projectTemplates } from '../../db/schema';
import { LLMService } from '../ai/llm';
import { RAGService } from '../ai/rag';
import { addWorkingDays, generateCode } from '@planneer/shared';
import { NoSimilarTemplatesError } from '../../lib/errors';

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
    
    // VALIDAÇÃO CRÍTICA: Verificar se há templates similares
    if (!similarTemplateIds || similarTemplateIds.length === 0) {
      // Tentar buscar templates similares novamente com threshold mínimo
      const ragResults = await rag.searchSimilarProjects(
        description || `${projectType}: projeto`,
        projectType,
        5,
        0.5 // threshold mínimo de similaridade
      );
      
      if (ragResults.length === 0) {
        throw new NoSimilarTemplatesError(
          `Não foram encontrados templates similares para este projeto (${projectType}). ` +
          `Por favor, cadastre pelo menos um template de projeto similar antes de gerar o cronograma. ` +
          `O sistema precisa de templates como referência para gerar atividades realistas.`
        );
      }
      
      // Usar os templates encontrados
      const foundTemplateIds = [...new Set(ragResults.map(r => r.templateId))];
      return this.generateWithTemplates({
        projectType,
        description,
        estimatedDuration,
        startDate,
        milestones,
        similarTemplateIds: foundTemplateIds,
      });
    }
    
    return this.generateWithTemplates(options);
  }
  
  private async generateWithTemplates(options: GenerateOptions): Promise<GeneratedSchedule> {
    const { projectType, description, estimatedDuration, startDate, milestones, similarTemplateIds } = options;
    
    // Get context from similar templates
    let templateContext = '';
    if (similarTemplateIds && similarTemplateIds.length > 0) {
      templateContext = await rag.getTemplateContext(similarTemplateIds);
    }
    
    // Get activities from all similar templates
    let referenceActivities: any[] = [];
    if (similarTemplateIds && similarTemplateIds.length > 0) {
      for (const templateId of similarTemplateIds) {
        // First, try to get activities from template_activities table
        let activities = await db.query.templateActivities.findMany({
          where: eq(templateActivities.templateId, templateId),
        });
        
        // If no activities in table, try to get from metadata (fallback for old templates)
        if (activities.length === 0) {
          const template = await db.query.projectTemplates.findFirst({
            where: eq(projectTemplates.id, templateId),
          });
          
          if (template?.metadata) {
            const metadata = template.metadata as any;
            const metadataActivities = metadata.activities || [];
            
            // Convert metadata activities to the same format as template_activities
            activities = metadataActivities.map((activity: any) => ({
              id: nanoid(),
              templateId: templateId,
              code: activity.code || `ACT${nanoid()}`,
              name: activity.name || "Unnamed Activity",
              description: activity.description || null,
              duration: activity.duration ? String(activity.duration) : null,
              durationUnit: activity.durationUnit || "days",
              wbsPath: activity.wbsPath || null,
              predecessors: activity.predecessors && Array.isArray(activity.predecessors)
                ? activity.predecessors.join(",")
                : activity.predecessors || null,
              resources: activity.resources && Array.isArray(activity.resources)
                ? activity.resources.join(",")
                : activity.resources || null,
              createdAt: new Date(),
            }));
          }
        }
        
        referenceActivities.push(...activities);
      }
    }
    
    // VALIDAÇÃO: Verificar se há atividades de referência
    if (referenceActivities.length === 0) {
      throw new NoSimilarTemplatesError(
        `Os templates similares encontrados não possuem atividades cadastradas. ` +
        `Por favor, certifique-se de que os templates têm atividades antes de gerar o cronograma.`
      );
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
    
    const totalReferenceActivities = referenceActivities.length;
    
    // Group activities by WBS path to show structure
    const activitiesByWBS = new Map<string, any[]>();
    for (const activity of referenceActivities) {
      const wbsPath = activity.wbsPath || 'ROOT';
      if (!activitiesByWBS.has(wbsPath)) {
        activitiesByWBS.set(wbsPath, []);
      }
      activitiesByWBS.get(wbsPath)!.push(activity);
    }
    
    // Show all activities or a large representative sample (up to 500 for very large templates)
    // This gives the LLM full context without artificial limits
    const maxActivitiesToShow = Math.min(500, referenceActivities.length);
    const activitiesToShow = referenceActivities.slice(0, maxActivitiesToShow);
    
    // Build prompt focused on using the template as complete reference
    let prompt = `Gere um cronograma de projeto estruturado em JSON para:

TIPO DE PROJETO: ${projectType}
DESCRIÇÃO: ${description}
${estimatedDuration ? `DURAÇÃO ESTIMADA: ${estimatedDuration}` : ''}
${milestones?.length ? `MARCOS IMPORTANTES: ${milestones.join(', ')}` : ''}

${templateContext ? `REFERÊNCIA DE PROJETOS SIMILARES:\n${templateContext}\n` : ''}

INFORMAÇÕES SOBRE OS TEMPLATES DE REFERÊNCIA:
- Total de atividades disponíveis nos templates: ${totalReferenceActivities}
- Estruturas WBS identificadas: ${activitiesByWBS.size}
${totalReferenceActivities > maxActivitiesToShow ? `- Mostrando ${maxActivitiesToShow} atividades abaixo (de ${totalReferenceActivities} totais disponíveis)` : ''}

ATIVIDADES DE REFERÊNCIA DO TEMPLATE:
${activitiesToShow.map(a => {
  const wbsInfo = a.wbsPath ? ` [WBS: ${a.wbsPath}]` : '';
  return `- ${a.code}: ${a.name}${a.duration ? ` (${a.duration} ${a.durationUnit || 'dias'})` : ''}${wbsInfo}`;
}).join('\n')}
${referenceActivities.length > maxActivitiesToShow ? `\n... e mais ${referenceActivities.length - maxActivitiesToShow} atividades adicionais nos templates (total: ${totalReferenceActivities} atividades disponíveis como referência)` : ''}

REGRAS IMPORTANTES:
1. Use o template como referência COMPLETA - ele tem ${totalReferenceActivities} atividades que representam a estrutura e escopo típico deste tipo de projeto
2. Gere as atividades NECESSÁRIAS baseadas nas especificações do projeto e na estrutura do template
3. Seja COERENTE com o template: se o template tem muitas atividades detalhadas, seu cronograma deve refletir esse nível de detalhamento
4. Adapte as atividades do template para o projeto específico, mantendo a estrutura e o nível de detalhe apropriado
5. Crie uma estrutura WBS hierárquica baseada na estrutura dos templates similares
6. Use durações realistas baseadas nas atividades de referência do template
7. Defina predecessoras lógicas baseadas nas dependências dos templates
8. Inclua marcos nas datas importantes mencionadas
9. O número de atividades deve ser NATURAL e COERENTE com o template - não force um número específico, mas também não gere apenas um resumo mínimo
10. Retorne APENAS JSON válido, sem markdown ou explicações

COERÊNCIA COM O TEMPLATE:
- O template tem ${totalReferenceActivities} atividades que representam a estrutura completa deste tipo de projeto
- Seu cronograma deve ser coerente com essa estrutura e nível de detalhamento
- Gere as atividades necessárias para o projeto, usando o template como guia completo
- Mantenha a proporção e o nível de detalhe do template quando apropriado

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
      "name": "Atividade (baseada nas referências)",
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
          content: `Você é um especialista em planejamento de projetos. Gere cronogramas estruturados, realistas e coerentes com os templates de referência.

PRINCÍPIOS:
- Use o template como referência completa para entender a estrutura e o nível de detalhe apropriado
- Gere as atividades NECESSÁRIAS baseadas nas especificações do projeto e na estrutura do template
- Seja COERENTE com o template - mantenha o nível de detalhamento e a estrutura quando apropriado
- Não force um número específico de atividades, mas gere um cronograma completo e coerente
- Adapte o template para o projeto específico, mantendo a coerência estrutural
- Retorne APENAS JSON válido, sem markdown ou explicações` 
        },
        { role: 'user', content: prompt },
      ]);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Log for debugging (informational only, no warnings about target)
        const generatedCount = parsed.activities?.length || 0;
        console.log(`[ScheduleGenerator] Generated schedule: ${generatedCount} activities (reference template has ${totalReferenceActivities} activities)`);
        
        return parsed;
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




