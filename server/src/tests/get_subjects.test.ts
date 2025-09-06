import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { subjectsTable } from '../db/schema';
import { type CreateSubjectInput } from '../schema';
import { getSubjects } from '../handlers/get_subjects';

describe('getSubjects', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no subjects exist', async () => {
    const result = await getSubjects();

    expect(result).toEqual([]);
  });

  it('should return all subjects when they exist', async () => {
    // Create test subjects directly in database
    const testSubjects: CreateSubjectInput[] = [
      {
        name: 'Mathematics',
        code: 'MATH101'
      },
      {
        name: 'English',
        code: 'ENG101'
      },
      {
        name: 'Science',
        code: 'SCI101'
      }
    ];

    // Insert test subjects
    await db.insert(subjectsTable)
      .values(testSubjects)
      .execute();

    const result = await getSubjects();

    expect(result).toHaveLength(3);
    
    // Verify all subjects are returned with correct properties
    const mathSubject = result.find(s => s.code === 'MATH101');
    expect(mathSubject).toBeDefined();
    expect(mathSubject!.name).toEqual('Mathematics');
    expect(mathSubject!.id).toBeDefined();
    expect(mathSubject!.created_at).toBeInstanceOf(Date);

    const englishSubject = result.find(s => s.code === 'ENG101');
    expect(englishSubject).toBeDefined();
    expect(englishSubject!.name).toEqual('English');

    const scienceSubject = result.find(s => s.code === 'SCI101');
    expect(scienceSubject).toBeDefined();
    expect(scienceSubject!.name).toEqual('Science');
  });

  it('should return subjects ordered by creation time', async () => {
    // Create subjects with slight delay to ensure different timestamps
    await db.insert(subjectsTable)
      .values({
        name: 'First Subject',
        code: 'FIRST'
      })
      .execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(subjectsTable)
      .values({
        name: 'Second Subject',
        code: 'SECOND'
      })
      .execute();

    const result = await getSubjects();

    expect(result).toHaveLength(2);
    // Subjects should be returned in database order (by id/creation time)
    expect(result[0].code).toEqual('FIRST');
    expect(result[1].code).toEqual('SECOND');
  });

  it('should handle large number of subjects', async () => {
    // Create many subjects to test performance
    const manySubjects = [];
    for (let i = 1; i <= 50; i++) {
      manySubjects.push({
        name: `Subject ${i}`,
        code: `SUB${i.toString().padStart(3, '0')}`
      });
    }

    await db.insert(subjectsTable)
      .values(manySubjects)
      .execute();

    const result = await getSubjects();

    expect(result).toHaveLength(50);
    
    // Verify first and last subjects
    expect(result[0].name).toEqual('Subject 1');
    expect(result[0].code).toEqual('SUB001');
    expect(result[49].name).toEqual('Subject 50');
    expect(result[49].code).toEqual('SUB050');

    // Verify all have required properties
    result.forEach(subject => {
      expect(subject.id).toBeDefined();
      expect(subject.name).toBeDefined();
      expect(subject.code).toBeDefined();
      expect(subject.created_at).toBeInstanceOf(Date);
    });
  });

  it('should return subjects with all required fields', async () => {
    await db.insert(subjectsTable)
      .values({
        name: 'Complete Subject',
        code: 'COMPLETE'
      })
      .execute();

    const result = await getSubjects();

    expect(result).toHaveLength(1);
    const subject = result[0];
    
    // Verify all schema fields are present
    expect(subject.id).toBeTypeOf('number');
    expect(subject.name).toBeTypeOf('string');
    expect(subject.code).toBeTypeOf('string');
    expect(subject.created_at).toBeInstanceOf(Date);
    expect(subject.name).toEqual('Complete Subject');
    expect(subject.code).toEqual('COMPLETE');
  });
});