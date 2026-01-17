import { describe, expect, it } from 'bun:test';
import { generateXER } from '../services/export/xer-generator';
import { generateXML } from '../services/export/xml-generator';

const mockSchedule = {
  id: 'schedule-1',
  name: 'Test Schedule',
  description: 'Test Description',
  startDate: '2024-03-01',
  endDate: '2024-04-30',
  project: {
    name: 'Test Project',
    organization: {
      name: 'Test Org',
    },
  },
  activities: [
    {
      id: 'act-1',
      code: 'A1000',
      name: 'Start Milestone',
      description: null,
      duration: 0,
      startDate: '2024-03-01',
      endDate: '2024-03-01',
      wbs: { id: 'wbs-1', code: '1', name: 'Phase 1' },
      predecessors: [],
      resourceAssignments: [],
    },
    {
      id: 'act-2',
      code: 'A1010',
      name: 'Task 1',
      description: 'First task',
      duration: 10,
      startDate: '2024-03-02',
      endDate: '2024-03-15',
      wbs: { id: 'wbs-1', code: '1', name: 'Phase 1' },
      predecessors: [
        { id: 'pred-1', type: 'FS', lag: 0, predecessorId: 'act-1' },
      ],
      resourceAssignments: [
        { units: 1, resource: { id: 'rsrc-1', code: 'ENG', name: 'Engineer' } },
      ],
    },
    {
      id: 'act-3',
      code: 'A1020',
      name: 'End Milestone',
      description: null,
      duration: 0,
      startDate: '2024-04-30',
      endDate: '2024-04-30',
      wbs: { id: 'wbs-2', code: '2', name: 'Phase 2' },
      predecessors: [
        { id: 'pred-2', type: 'FS', lag: 0, predecessorId: 'act-2' },
      ],
      resourceAssignments: [],
    },
  ],
  wbsItems: [
    { id: 'wbs-1', code: '1', name: 'Phase 1', parentId: null, level: 1 },
    { id: 'wbs-2', code: '2', name: 'Phase 2', parentId: null, level: 1 },
  ],
};

describe('XER Generator', () => {
  describe('generateXER', () => {
    it('should generate valid XER file structure', async () => {
      const xer = await generateXER(mockSchedule);
      
      // Check header
      expect(xer).toContain('ERMHDR');
      
      // Check required tables
      expect(xer).toContain('%T\tPROJECT');
      expect(xer).toContain('%T\tPROJWBS');
      expect(xer).toContain('%T\tCALENDAR');
      expect(xer).toContain('%T\tTASK');
      expect(xer).toContain('%T\tTASKPRED');
      
      // Check end marker
      expect(xer).toContain('%E');
    });

    it('should include project information', async () => {
      const xer = await generateXER(mockSchedule);
      
      expect(xer).toContain('Test Project');
      expect(xer).toContain('Test Org');
    });

    it('should include WBS items', async () => {
      const xer = await generateXER(mockSchedule);
      
      expect(xer).toContain('Phase 1');
      expect(xer).toContain('Phase 2');
    });

    it('should include activities', async () => {
      const xer = await generateXER(mockSchedule);
      
      expect(xer).toContain('A1000');
      expect(xer).toContain('Start Milestone');
      expect(xer).toContain('A1010');
      expect(xer).toContain('Task 1');
    });

    it('should include resources when present', async () => {
      const xer = await generateXER(mockSchedule);
      
      expect(xer).toContain('%T\tRSRC');
      expect(xer).toContain('Engineer');
    });
  });
});

describe('XML Generator', () => {
  describe('generateXML', () => {
    it('should generate valid XML structure', async () => {
      const xml = await generateXML(mockSchedule);
      
      // Check XML declaration
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      
      // Check root element
      expect(xml).toContain('<APIBusinessObjects');
      expect(xml).toContain('</APIBusinessObjects>');
      
      // Check Project element
      expect(xml).toContain('<Project>');
      expect(xml).toContain('</Project>');
    });

    it('should include project information', async () => {
      const xml = await generateXML(mockSchedule);
      
      expect(xml).toContain('<Name>Test Schedule</Name>');
      expect(xml).toContain('<Description>Test Description</Description>');
      expect(xml).toContain(`<ObjectId>${mockSchedule.id}</ObjectId>`);
    });

    it('should include WBS elements', async () => {
      const xml = await generateXML(mockSchedule);
      
      expect(xml).toContain('<WBS>');
      expect(xml).toContain('<WBSElement>');
      expect(xml).toContain('<Code>1</Code>');
      expect(xml).toContain('<Name>Phase 1</Name>');
    });

    it('should include activities', async () => {
      const xml = await generateXML(mockSchedule);
      
      expect(xml).toContain('<Activity>');
      expect(xml).toContain('<ActivityElement>');
      expect(xml).toContain('<Id>A1000</Id>');
      expect(xml).toContain('<Name>Start Milestone</Name>');
    });

    it('should include relationships', async () => {
      const xml = await generateXML(mockSchedule);
      
      expect(xml).toContain('<Relationship>');
      expect(xml).toContain('<RelationshipElement>');
      expect(xml).toContain('<PredecessorActivityObjectId>');
      expect(xml).toContain('<SuccessorActivityObjectId>');
    });

    it('should include resources and assignments', async () => {
      const xml = await generateXML(mockSchedule);
      
      expect(xml).toContain('<Resource>');
      expect(xml).toContain('<ResourceElement>');
      expect(xml).toContain('<Name>Engineer</Name>');
      expect(xml).toContain('<ResourceAssignment>');
    });

    it('should escape XML special characters', async () => {
      const scheduleWithSpecialChars = {
        ...mockSchedule,
        name: 'Test <Schedule> & "Quotes"',
        description: "Test's Description",
      };
      
      const xml = await generateXML(scheduleWithSpecialChars);
      
      expect(xml).toContain('&lt;Schedule&gt;');
      expect(xml).toContain('&amp;');
      expect(xml).toContain('&quot;Quotes&quot;');
      expect(xml).toContain('&apos;s Description');
    });
  });
});






