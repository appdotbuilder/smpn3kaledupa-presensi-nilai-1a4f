import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { subjectsTable } from '../db/schema';
import { type CreateSubjectInput } from '../schema';
import { createSubject } from '../handlers/create_subject';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateSubjectInput = {
  name: 'Mathematics',
  code: 'MATH101'
};

const secondTestInput: CreateSubjectInput = {
  name: 'Indonesian Language',
  code: 'INDO201'
};

describe('createSubject', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a subject', async () => {
    const result = await createSubject(testInput);

    // Basic field validation
    expect(result.name).toEqual('Mathematics');
    expect(result.code).toEqual('MATH101');
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('number');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save subject to database', async () => {
    const result = await createSubject(testInput);

    // Query using proper drizzle syntax
    const subjects = await db.select()
      .from(subjectsTable)
      .where(eq(subjectsTable.id, result.id))
      .execute();

    expect(subjects).toHaveLength(1);
    expect(subjects[0].name).toEqual('Mathematics');
    expect(subjects[0].code).toEqual('MATH101');
    expect(subjects[0].created_at).toBeInstanceOf(Date);
    expect(subjects[0].id).toEqual(result.id);
  });

  it('should create multiple subjects with different codes', async () => {
    const result1 = await createSubject(testInput);
    const result2 = await createSubject(secondTestInput);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.code).toEqual('MATH101');
    expect(result2.code).toEqual('INDO201');

    // Verify both subjects exist in database
    const allSubjects = await db.select()
      .from(subjectsTable)
      .execute();

    expect(allSubjects).toHaveLength(2);
    
    const mathSubject = allSubjects.find(s => s.code === 'MATH101');
    const indoSubject = allSubjects.find(s => s.code === 'INDO201');
    
    expect(mathSubject).toBeDefined();
    expect(indoSubject).toBeDefined();
    expect(mathSubject?.name).toEqual('Mathematics');
    expect(indoSubject?.name).toEqual('Indonesian Language');
  });

  it('should enforce unique subject code constraint', async () => {
    await createSubject(testInput);

    // Try to create another subject with the same code
    const duplicateInput: CreateSubjectInput = {
      name: 'Advanced Mathematics',
      code: 'MATH101' // Same code as testInput
    };

    await expect(createSubject(duplicateInput)).rejects.toThrow(/unique/i);
  });

  it('should handle subject codes with different formats', async () => {
    const specialFormatInputs: CreateSubjectInput[] = [
      { name: 'Science', code: 'SCI-001' },
      { name: 'English', code: 'ENG_101' },
      { name: 'Physical Education', code: 'PE2024' }
    ];

    for (const input of specialFormatInputs) {
      const result = await createSubject(input);
      expect(result.name).toEqual(input.name);
      expect(result.code).toEqual(input.code);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    }

    // Verify all subjects were created
    const allSubjects = await db.select()
      .from(subjectsTable)
      .execute();

    expect(allSubjects).toHaveLength(3);
  });
});