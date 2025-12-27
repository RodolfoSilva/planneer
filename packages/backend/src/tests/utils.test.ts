import { describe, expect, it } from 'bun:test';
import {
  slugify,
  formatDateISO,
  calculateWorkingDays,
  addWorkingDays,
  formatDuration,
  generateCode,
  isValidEmail,
  truncateText,
  isEmpty,
  chunkArray,
} from '@planneer/shared';

describe('Shared Utils', () => {
  describe('slugify', () => {
    it('should convert text to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('Construção Civil')).toBe('construcao-civil');
      expect(slugify('Test--Multiple---Dashes')).toBe('test-multiple-dashes');
    });
    
    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });
    
    it('should limit length', () => {
      const longText = 'a'.repeat(200);
      expect(slugify(longText).length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('formatDateISO', () => {
    it('should format date to ISO string without time', () => {
      const date = new Date('2024-03-15T10:30:00Z');
      expect(formatDateISO(date)).toBe('2024-03-15');
    });
  });
  
  describe('calculateWorkingDays', () => {
    it('should calculate working days excluding weekends', () => {
      // Monday to Friday = 5 working days
      const start = new Date('2024-03-11'); // Monday
      const end = new Date('2024-03-15'); // Friday
      expect(calculateWorkingDays(start, end)).toBe(5);
    });
    
    it('should exclude weekend days', () => {
      // Monday to next Monday = 6 working days (excludes Sat, Sun)
      const start = new Date('2024-03-11'); // Monday
      const end = new Date('2024-03-18'); // Next Monday
      expect(calculateWorkingDays(start, end)).toBe(6);
    });
  });
  
  describe('addWorkingDays', () => {
    it('should add working days skipping weekends', () => {
      const start = new Date('2024-03-11'); // Monday
      const result = addWorkingDays(start, 5);
      // 5 working days from Monday = next Monday
      expect(result.getDay()).toBe(1); // Monday
    });
  });
  
  describe('formatDuration', () => {
    it('should format duration in days', () => {
      expect(formatDuration(0)).toBe('0 dias');
      expect(formatDuration(1)).toBe('1 dia');
      expect(formatDuration(5)).toBe('5 dias');
    });
    
    it('should format duration in weeks', () => {
      expect(formatDuration(7)).toBe('1 semana');
      expect(formatDuration(14)).toBe('2 semanas');
      expect(formatDuration(10)).toBe('1 semana e 3 dias');
    });
  });
  
  describe('generateCode', () => {
    it('should generate padded codes', () => {
      expect(generateCode('A', 1)).toBe('A0001');
      expect(generateCode('ACT', 100)).toBe('ACT0100');
      expect(generateCode('WBS', 5, 3)).toBe('WBS005');
    });
  });
  
  describe('isValidEmail', () => {
    it('should validate email format', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });
  });
  
  describe('truncateText', () => {
    it('should truncate long text', () => {
      expect(truncateText('Hello World', 20)).toBe('Hello World');
      expect(truncateText('Hello World', 8)).toBe('Hello...');
    });
    
    it('should use custom suffix', () => {
      expect(truncateText('Hello World', 8, '…')).toBe('Hello W…');
    });
  });
  
  describe('isEmpty', () => {
    it('should detect empty values', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
    });
    
    it('should detect non-empty values', () => {
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty(0)).toBe(false);
    });
  });
  
  describe('chunkArray', () => {
    it('should chunk array into smaller arrays', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(chunkArray(arr, 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunkArray(arr, 3)).toEqual([[1, 2, 3], [4, 5]]);
    });
    
    it('should handle empty arrays', () => {
      expect(chunkArray([], 2)).toEqual([]);
    });
  });
});



