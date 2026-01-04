import { describe, expect, it } from 'bun:test';
import { parseXMLFile } from '../services/parser/xml-parser';

describe('XML Parser', () => {
  describe('parseXMLFile', () => {
    it('should parse basic XML project structure', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects>
  <Project>
    <ObjectId>1</ObjectId>
    <Name>Test Project</Name>
    <Description>Test Description</Description>
    <Activity>
      <ObjectId>A1</ObjectId>
      <Id>ACT001</Id>
      <Name>First Activity</Name>
      <PlannedDuration>PT40H</PlannedDuration>
    </Activity>
    <Activity>
      <ObjectId>A2</ObjectId>
      <Id>ACT002</Id>
      <Name>Second Activity</Name>
      <PlannedDuration>PT16H</PlannedDuration>
    </Activity>
  </Project>
</APIBusinessObjects>`;

      const result = await parseXMLFile(xml);
      
      expect(result.projectName).toBe('Test Project');
      expect(result.activities.length).toBe(2);
      expect(result.activities[0].code).toBe('ACT001');
      expect(result.activities[0].name).toBe('First Activity');
      expect(result.activities[0].duration).toBe(5); // 40 hours = 5 days
      expect(result.activities[1].duration).toBe(2); // 16 hours = 2 days
    });

    it('should parse WBS structure', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects>
  <Project>
    <Name>Project with WBS</Name>
    <WBS>
      <ObjectId>W1</ObjectId>
      <Code>1</Code>
      <Name>Phase 1</Name>
    </WBS>
    <Activity>
      <ObjectId>A1</ObjectId>
      <Id>ACT001</Id>
      <Name>Activity in Phase 1</Name>
      <WBSObjectId>W1</WBSObjectId>
    </Activity>
  </Project>
</APIBusinessObjects>`;

      const result = await parseXMLFile(xml);
      
      expect(result.activities[0].wbsPath).toBe('Phase 1');
    });

    it('should handle missing fields gracefully', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects>
  <Project>
    <Activity>
      <Name>Minimal Activity</Name>
    </Activity>
  </Project>
</APIBusinessObjects>`;

      const result = await parseXMLFile(xml);
      
      expect(result.activities.length).toBe(1);
      expect(result.activities[0].name).toBe('Minimal Activity');
      expect(result.activities[0].code).toMatch(/ACT/);
    });

    it('should set correct metadata', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<APIBusinessObjects>
  <Project>
    <ObjectId>123</ObjectId>
    <Name>Metadata Test</Name>
    <WBS><Code>1</Code><Name>WBS1</Name></WBS>
    <Resource><ResourceId>R1</ResourceId><Name>Resource 1</Name></Resource>
    <Activity><Id>A1</Id><Name>Act 1</Name></Activity>
  </Project>
</APIBusinessObjects>`;

      const result = await parseXMLFile(xml);
      
      expect(result.metadata.sourceFormat).toBe('xml');
      expect(result.metadata.activityCount).toBe(1);
      expect(result.metadata).toHaveProperty('importedAt');
    });
  });
});




