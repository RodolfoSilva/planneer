import { XMLParser } from 'fast-xml-parser';

interface ParsedActivity {
  code: string;
  name: string;
  description?: string;
  duration?: number;
  durationUnit?: string;
  wbsPath?: string;
  predecessors?: string[];
  resources?: string[];
}

interface ParsedData {
  projectName: string;
  projectDescription?: string;
  activities: ParsedActivity[];
  totalDuration?: number;
  metadata: Record<string, unknown>;
}

export async function parseXML(content: string): Promise<ParsedData> {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      parseTagValue: true,
    });
    
    const data = parser.parse(content);
    
    // Handle P6 XML format
    const project = data.APIBusinessObjects?.Project || 
                    data.Project ||
                    data.project ||
                    {};
    
    const projectArray = Array.isArray(project) ? project : [project];
    const mainProject = projectArray[0] || {};
    
    // Extract WBS
    const wbsMap = new Map<string, string>();
    const wbsItems = mainProject.WBS || mainProject.wbs || [];
    const wbsArray = Array.isArray(wbsItems) ? wbsItems : [wbsItems];
    
    for (const wbs of wbsArray) {
      if (wbs) {
        const id = wbs.ObjectId || wbs.WBSObjectId || wbs['@_ObjectId'] || '';
        const name = wbs.Name || wbs.WBSName || wbs['#text'] || '';
        if (id) {
          wbsMap.set(String(id), name);
        }
      }
    }
    
    // Extract activities
    const activityItems = mainProject.Activity || mainProject.activity || [];
    const activityArray = Array.isArray(activityItems) ? activityItems : [activityItems];
    const activities: ParsedActivity[] = [];
    
    for (const act of activityArray) {
      if (!act) continue;
      
      const activity: ParsedActivity = {
        code: act.Id || act.ActivityId || act['@_Id'] || `ACT${activities.length + 1}`,
        name: act.Name || act.ActivityName || 'Unnamed Activity',
        description: act.Description || act.Notes || undefined,
        duration: parseDuration(act.PlannedDuration || act.Duration || act.OriginalDuration),
        durationUnit: 'days',
        wbsPath: act.WBSObjectId ? wbsMap.get(String(act.WBSObjectId)) : undefined,
      };
      
      activities.push(activity);
    }
    
    // Extract relationships
    const relationships = mainProject.Relationship || mainProject.relationship || [];
    const relArray = Array.isArray(relationships) ? relationships : [relationships];
    
    const predMap = new Map<string, string[]>();
    
    for (const rel of relArray) {
      if (!rel) continue;
      
      const successorId = rel.SuccessorActivityObjectId || rel.SuccessorActivityId;
      const predecessorId = rel.PredecessorActivityObjectId || rel.PredecessorActivityId;
      
      if (successorId && predecessorId) {
        // Find predecessor activity
        const predActivity = activityArray.find(a => 
          a && (a.ObjectId === predecessorId || a.ActivityId === predecessorId)
        );
        
        if (predActivity) {
          const successorCode = activityArray.find(a =>
            a && (a.ObjectId === successorId || a.ActivityId === successorId)
          )?.Id || successorId;
          
          if (!predMap.has(successorCode)) {
            predMap.set(successorCode, []);
          }
          
          predMap.get(successorCode)!.push(predActivity.Id || predActivity.ActivityId);
        }
      }
    }
    
    // Add predecessors to activities
    for (const activity of activities) {
      if (predMap.has(activity.code)) {
        activity.predecessors = predMap.get(activity.code);
      }
    }
    
    // Extract resources
    const resources = mainProject.Resource || mainProject.resource || [];
    const resourceArray = Array.isArray(resources) ? resources : [resources];
    const rsrcMap = new Map<string, string>();
    
    for (const rsrc of resourceArray) {
      if (rsrc) {
        const id = rsrc.ObjectId || rsrc.ResourceId || rsrc['@_ObjectId'] || '';
        const name = rsrc.Name || rsrc.ResourceName || '';
        if (id) {
          rsrcMap.set(String(id), name);
        }
      }
    }
    
    // Resource assignments
    const assignments = mainProject.ResourceAssignment || mainProject.resourceAssignment || [];
    const assignArray = Array.isArray(assignments) ? assignments : [assignments];
    
    for (const assign of assignArray) {
      if (!assign) continue;
      
      const activityId = assign.ActivityObjectId || assign.ActivityId;
      const resourceId = assign.ResourceObjectId || assign.ResourceId;
      
      if (activityId && resourceId) {
        const activity = activities.find(a => {
          const act = activityArray.find(x => x?.Id === a.code || x?.ActivityId === a.code);
          return act && (act.ObjectId === activityId || act.ActivityId === activityId);
        });
        
        if (activity) {
          const rsrcName = rsrcMap.get(String(resourceId));
          if (rsrcName) {
            if (!activity.resources) {
              activity.resources = [];
            }
            activity.resources.push(rsrcName);
          }
        }
      }
    }
    
    // Calculate total duration
    const totalDuration = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
    
    return {
      projectName: mainProject.Name || mainProject.ProjectName || mainProject['@_Name'] || 'Imported Project',
      projectDescription: mainProject.Description || mainProject.Notes,
      activities,
      totalDuration,
      metadata: {
        sourceFormat: 'xml',
        projectId: mainProject.ObjectId || mainProject.ProjectId,
        wbsCount: wbsArray.length,
        activityCount: activities.length,
        resourceCount: resourceArray.length,
        importedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('XML parsing error:', error);
    throw new Error(`Failed to parse XML file: ${error}`);
  }
}

function parseDuration(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  
  if (typeof value === 'number') return value;
  
  if (typeof value === 'string') {
    // Handle ISO 8601 duration format (PT8H = 8 hours = 1 day)
    const match = value.match(/PT(\d+)H/);
    if (match) {
      return parseInt(match[1], 10) / 8; // Convert hours to days
    }
    
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  
  return undefined;
}

