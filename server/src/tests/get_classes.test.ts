import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { classesTable } from '../db/schema';
import { type CreateClassInput } from '../schema';
import { getClasses } from '../handlers/get_classes';

describe('getClasses', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no classes exist', async () => {
    const result = await getClasses();
    expect(result).toEqual([]);
  });

  it('should return all classes when no filter is provided', async () => {
    // Create test classes
    await db.insert(classesTable).values([
      {
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 8B',
        grade_level: 8,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 9C',
        grade_level: 9,
        academic_year: '2023/2024'
      }
    ]).execute();

    const result = await getClasses();

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('Class 7A');
    expect(result[0].grade_level).toEqual(7);
    expect(result[0].academic_year).toEqual('2024/2025');
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter classes by academic year', async () => {
    // Create test classes with different academic years
    await db.insert(classesTable).values([
      {
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 8A',
        grade_level: 8,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 7B',
        grade_level: 7,
        academic_year: '2023/2024'
      }
    ]).execute();

    const result = await getClasses({ academic_year: '2024/2025' });

    expect(result).toHaveLength(2);
    expect(result[0].academic_year).toEqual('2024/2025');
    expect(result[1].academic_year).toEqual('2024/2025');
    expect(result.some(c => c.name === 'Class 7A')).toBe(true);
    expect(result.some(c => c.name === 'Class 8A')).toBe(true);
    expect(result.some(c => c.name === 'Class 7B')).toBe(false);
  });

  it('should filter classes by grade level', async () => {
    // Create test classes with different grade levels
    await db.insert(classesTable).values([
      {
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 7B',
        grade_level: 7,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 8A',
        grade_level: 8,
        academic_year: '2024/2025'
      }
    ]).execute();

    const result = await getClasses({ grade_level: 7 });

    expect(result).toHaveLength(2);
    expect(result[0].grade_level).toEqual(7);
    expect(result[1].grade_level).toEqual(7);
    expect(result.some(c => c.name === 'Class 7A')).toBe(true);
    expect(result.some(c => c.name === 'Class 7B')).toBe(true);
    expect(result.some(c => c.name === 'Class 8A')).toBe(false);
  });

  it('should filter classes by both academic year and grade level', async () => {
    // Create test classes with various combinations
    await db.insert(classesTable).values([
      {
        name: 'Class 7A 2024',
        grade_level: 7,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 7A 2023',
        grade_level: 7,
        academic_year: '2023/2024'
      },
      {
        name: 'Class 8A 2024',
        grade_level: 8,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 8A 2023',
        grade_level: 8,
        academic_year: '2023/2024'
      }
    ]).execute();

    const result = await getClasses({ 
      academic_year: '2024/2025', 
      grade_level: 7 
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Class 7A 2024');
    expect(result[0].grade_level).toEqual(7);
    expect(result[0].academic_year).toEqual('2024/2025');
  });

  it('should return empty array when no classes match the filter', async () => {
    // Create test classes
    await db.insert(classesTable).values([
      {
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      }
    ]).execute();

    const result = await getClasses({ academic_year: '2025/2026' });
    expect(result).toEqual([]);
  });

  it('should order results by grade level and name', async () => {
    // Create test classes in mixed order
    await db.insert(classesTable).values([
      {
        name: 'Class 8B',
        grade_level: 8,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 7C',
        grade_level: 7,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      },
      {
        name: 'Class 9A',
        grade_level: 9,
        academic_year: '2024/2025'
      }
    ]).execute();

    const result = await getClasses();

    expect(result).toHaveLength(4);
    // Should be ordered by grade level first, then name
    expect(result[0].grade_level).toEqual(7);
    expect(result[0].name).toEqual('Class 7A');
    expect(result[1].grade_level).toEqual(7);
    expect(result[1].name).toEqual('Class 7C');
    expect(result[2].grade_level).toEqual(8);
    expect(result[2].name).toEqual('Class 8B');
    expect(result[3].grade_level).toEqual(9);
    expect(result[3].name).toEqual('Class 9A');
  });

  it('should handle edge case grade levels correctly', async () => {
    // Create classes with edge case grade levels
    await db.insert(classesTable).values([
      {
        name: 'Class 7A',
        grade_level: 7, // minimum
        academic_year: '2024/2025'
      },
      {
        name: 'Class 9A',
        grade_level: 9, // maximum
        academic_year: '2024/2025'
      }
    ]).execute();

    const resultGrade7 = await getClasses({ grade_level: 7 });
    const resultGrade9 = await getClasses({ grade_level: 9 });

    expect(resultGrade7).toHaveLength(1);
    expect(resultGrade7[0].grade_level).toEqual(7);

    expect(resultGrade9).toHaveLength(1);
    expect(resultGrade9[0].grade_level).toEqual(9);
  });
});