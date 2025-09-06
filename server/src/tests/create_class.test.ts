import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { classesTable } from '../db/schema';
import { type CreateClassInput } from '../schema';
import { createClass } from '../handlers/create_class';
import { eq } from 'drizzle-orm';

// Simple test input
const testInput: CreateClassInput = {
  name: 'VII-A',
  grade_level: 7,
  academic_year: '2024/2025'
};

describe('createClass', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a class', async () => {
    const result = await createClass(testInput);

    // Basic field validation
    expect(result.name).toEqual('VII-A');
    expect(result.grade_level).toEqual(7);
    expect(result.academic_year).toEqual('2024/2025');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save class to database', async () => {
    const result = await createClass(testInput);

    // Query using proper drizzle syntax
    const classes = await db.select()
      .from(classesTable)
      .where(eq(classesTable.id, result.id))
      .execute();

    expect(classes).toHaveLength(1);
    expect(classes[0].name).toEqual('VII-A');
    expect(classes[0].grade_level).toEqual(7);
    expect(classes[0].academic_year).toEqual('2024/2025');
    expect(classes[0].created_at).toBeInstanceOf(Date);
  });

  it('should create multiple classes with different names', async () => {
    const class1Input: CreateClassInput = {
      name: 'VII-A',
      grade_level: 7,
      academic_year: '2024/2025'
    };

    const class2Input: CreateClassInput = {
      name: 'VII-B',
      grade_level: 7,
      academic_year: '2024/2025'
    };

    const result1 = await createClass(class1Input);
    const result2 = await createClass(class2Input);

    // Verify both classes were created with different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('VII-A');
    expect(result2.name).toEqual('VII-B');

    // Verify both classes exist in database
    const allClasses = await db.select()
      .from(classesTable)
      .execute();

    expect(allClasses).toHaveLength(2);
    expect(allClasses.some(c => c.name === 'VII-A')).toBe(true);
    expect(allClasses.some(c => c.name === 'VII-B')).toBe(true);
  });

  it('should handle different grade levels', async () => {
    const grade8Input: CreateClassInput = {
      name: 'VIII-A',
      grade_level: 8,
      academic_year: '2024/2025'
    };

    const grade9Input: CreateClassInput = {
      name: 'IX-A',
      grade_level: 9,
      academic_year: '2024/2025'
    };

    const result8 = await createClass(grade8Input);
    const result9 = await createClass(grade9Input);

    expect(result8.grade_level).toEqual(8);
    expect(result9.grade_level).toEqual(9);
    expect(result8.name).toEqual('VIII-A');
    expect(result9.name).toEqual('IX-A');
  });

  it('should handle different academic years', async () => {
    const currentYearInput: CreateClassInput = {
      name: 'VII-A',
      grade_level: 7,
      academic_year: '2024/2025'
    };

    const nextYearInput: CreateClassInput = {
      name: 'VII-A',
      grade_level: 7,
      academic_year: '2025/2026'
    };

    const currentResult = await createClass(currentYearInput);
    const nextResult = await createClass(nextYearInput);

    expect(currentResult.academic_year).toEqual('2024/2025');
    expect(nextResult.academic_year).toEqual('2025/2026');
    expect(currentResult.id).not.toEqual(nextResult.id);
  });
});