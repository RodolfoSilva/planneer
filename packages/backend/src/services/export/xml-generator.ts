import { formatDateISO } from '@planneer/shared';

interface ScheduleWithRelations {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  project: {
    name: string;
    organization: {
      name: string;
    };
  };
  activities: Array<{
    id: string;
    code: string;
    name: string;
    description: string | null;
    duration: number;
    startDate: string | null;
    endDate: string | null;
    wbs: { id: string; code: string; name: string } | null;
    predecessors: Array<{
      id: string;
      type: string;
      lag: number;
      predecessorId: string;
    }>;
    resourceAssignments: Array<{
      units: number;
      resource: { id: string; code: string; name: string };
    }>;
  }>;
  wbsItems: Array<{
    id: string;
    code: string;
    name: string;
    parentId: string | null;
    level: number;
  }>;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateXML(schedule: ScheduleWithRelations): Promise<string> {
  const now = new Date();
  const dateStr = formatDateISO(now);
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects xmlns="http://xmlns.oracle.com/Primavera/P6/V19.12/API/BusinessObjects">
  <Project>
    <ObjectId>${schedule.id}</ObjectId>
    <Id>${escapeXml(schedule.project.name)}</Id>
    <Name>${escapeXml(schedule.name)}</Name>
    <Description>${escapeXml(schedule.description || '')}</Description>
    <PlannedStartDate>${schedule.startDate || dateStr}</PlannedStartDate>
    <MustFinishByDate>${schedule.endDate || dateStr}</MustFinishByDate>
    <DataDate>${dateStr}</DataDate>
    <Status>Active</Status>
    <CreateDate>${dateStr}</CreateDate>
    <LastUpdateDate>${dateStr}</LastUpdateDate>
`;

  // WBS elements
  xml += `    <WBS>\n`;
  
  // Root WBS
  xml += `      <WBSElement>
        <ObjectId>WBS_ROOT_${schedule.id}</ObjectId>
        <Code>ROOT</Code>
        <Name>${escapeXml(schedule.name)}</Name>
        <Status>Active</Status>
        <SequenceNumber>1</SequenceNumber>
      </WBSElement>\n`;
  
  for (const wbs of schedule.wbsItems) {
    xml += `      <WBSElement>
        <ObjectId>${wbs.id}</ObjectId>
        <Code>${escapeXml(wbs.code)}</Code>
        <Name>${escapeXml(wbs.name)}</Name>
        <ParentObjectId>${wbs.parentId || `WBS_ROOT_${schedule.id}`}</ParentObjectId>
        <Status>Active</Status>
        <SequenceNumber>${wbs.level}</SequenceNumber>
      </WBSElement>\n`;
  }
  
  xml += `    </WBS>\n`;

  // Activities
  xml += `    <Activity>\n`;
  
  for (const activity of schedule.activities) {
    const durationHours = activity.duration * 8;
    
    xml += `      <ActivityElement>
        <ObjectId>${activity.id}</ObjectId>
        <Id>${escapeXml(activity.code)}</Id>
        <Name>${escapeXml(activity.name)}</Name>
        <WBSObjectId>${activity.wbs?.id || `WBS_ROOT_${schedule.id}`}</WBSObjectId>
        <Type>TaskDependent</Type>
        <Status>NotStarted</Status>
        <PlannedDuration>PT${durationHours}H</PlannedDuration>
        <RemainingDuration>PT${durationHours}H</RemainingDuration>
        <PlannedStartDate>${activity.startDate || schedule.startDate || dateStr}</PlannedStartDate>
        <PlannedFinishDate>${activity.endDate || schedule.endDate || dateStr}</PlannedFinishDate>
        <EarlyStartDate>${activity.startDate || schedule.startDate || dateStr}</EarlyStartDate>
        <EarlyFinishDate>${activity.endDate || schedule.endDate || dateStr}</EarlyFinishDate>
        <LateStartDate>${activity.startDate || schedule.startDate || dateStr}</LateStartDate>
        <LateFinishDate>${activity.endDate || schedule.endDate || dateStr}</LateFinishDate>
        <PercentComplete>0</PercentComplete>`;
    
    if (activity.description) {
      xml += `
        <Description>${escapeXml(activity.description)}</Description>`;
    }
    
    xml += `
      </ActivityElement>\n`;
  }
  
  xml += `    </Activity>\n`;

  // Relationships
  xml += `    <Relationship>\n`;
  
  for (const activity of schedule.activities) {
    for (const pred of activity.predecessors) {
      const lagHours = pred.lag * 8;
      
      xml += `      <RelationshipElement>
        <ObjectId>${pred.id}</ObjectId>
        <PredecessorActivityObjectId>${pred.predecessorId}</PredecessorActivityObjectId>
        <SuccessorActivityObjectId>${activity.id}</SuccessorActivityObjectId>
        <Type>${pred.type}</Type>
        <Lag>PT${lagHours}H</Lag>
      </RelationshipElement>\n`;
    }
  }
  
  xml += `    </Relationship>\n`;

  // Resources
  const uniqueResources = new Map<string, { id: string; code: string; name: string }>();
  for (const activity of schedule.activities) {
    for (const assignment of activity.resourceAssignments) {
      uniqueResources.set(assignment.resource.id, assignment.resource);
    }
  }
  
  if (uniqueResources.size > 0) {
    xml += `    <Resource>\n`;
    
    for (const rsrc of uniqueResources.values()) {
      xml += `      <ResourceElement>
        <ObjectId>${rsrc.id}</ObjectId>
        <Id>${escapeXml(rsrc.code)}</Id>
        <Name>${escapeXml(rsrc.name)}</Name>
        <ResourceType>Labor</ResourceType>
      </ResourceElement>\n`;
    }
    
    xml += `    </Resource>\n`;
    
    // Resource Assignments
    xml += `    <ResourceAssignment>\n`;
    
    for (const activity of schedule.activities) {
      for (const assignment of activity.resourceAssignments) {
        xml += `      <ResourceAssignmentElement>
        <ObjectId>RA_${activity.id}_${assignment.resource.id}</ObjectId>
        <ActivityObjectId>${activity.id}</ActivityObjectId>
        <ResourceObjectId>${assignment.resource.id}</ResourceObjectId>
        <PlannedUnits>${assignment.units}</PlannedUnits>
      </ResourceAssignmentElement>\n`;
      }
    }
    
    xml += `    </ResourceAssignment>\n`;
  }

  xml += `  </Project>
</APIBusinessObjects>`;

  return xml;
}



