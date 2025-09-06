import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gradeConfigsTable, subjectsTable, classesTable } from '../db/schema';
import { type CreateGradeConfigInput } from '../schema';
import { createGradeConfig } from '../handlers/create_grade_config';
import { eq } from 'drizzle-orm';

// Test data setup
const setupTestData = async () => {
  // Create test subject
  const subjectResult = await db.insert(subjectsTable)
    .values({
      name: 'Mathematics',
      code: 'MATH01'
    })
    .returning()
    .execute();

  // Create test class
  const classResult = await db.insert(classesTable)
    .values({
      name: 'Grade 8A',
      grade_level: 8,
      academic_year: '2024/2025'
    })
    .returning()
    .execute();

  return {
    subject_id: subjectResult[0].id,
    class_id: classResult[0].id
  };
};

describe('createGradeConfig', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a grade configuration with valid weights', async () => {
    const { subject_id, class_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id,
      class_id,
      daily_weight: 40,
      midterm_weight: 30,
      final_weight: 30,
      academic_year: '2024/2025'
    };

    const result = await createGradeConfig(testInput);

    // Basic field validation
    expect(result.subject_id).toEqual(subject_id);
    expect(result.class_id).toEqual(class_id);
    expect(result.daily_weight).toEqual(40);
    expect(result.midterm_weight).toEqual(30);
    expect(result.final_weight).toEqual(30);
    expect(result.academic_year).toEqual('2024/2025');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify numeric types
    expect(typeof result.daily_weight).toBe('number');
    expect(typeof result.midterm_weight).toBe('number');
    expect(typeof result.final_weight).toBe('number');
  });

  it('should save grade configuration to database', async () => {
    const { subject_id, class_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id,
      class_id,
      daily_weight: 50,
      midterm_weight: 25,
      final_weight: 25,
      academic_year: '2024/2025'
    };

    const result = await createGradeConfig(testInput);

    // Query using proper drizzle syntax
    const gradeConfigs = await db.select()
      .from(gradeConfigsTable)
      .where(eq(gradeConfigsTable.id, result.id))
      .execute();

    expect(gradeConfigs).toHaveLength(1);
    expect(gradeConfigs[0].subject_id).toEqual(subject_id);
    expect(gradeConfigs[0].class_id).toEqual(class_id);
    expect(parseFloat(gradeConfigs[0].daily_weight)).toEqual(50);
    expect(parseFloat(gradeConfigs[0].midterm_weight)).toEqual(25);
    expect(parseFloat(gradeConfigs[0].final_weight)).toEqual(25);
    expect(gradeConfigs[0].academic_year).toEqual('2024/2025');
    expect(gradeConfigs[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle different weight distributions', async () => {
    const { subject_id, class_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id,
      class_id,
      daily_weight: 60,
      midterm_weight: 20,
      final_weight: 20,
      academic_year: '2024/2025'
    };

    const result = await createGradeConfig(testInput);

    expect(result.daily_weight).toEqual(60);
    expect(result.midterm_weight).toEqual(20);
    expect(result.final_weight).toEqual(20);
  });

  it('should throw error when subject does not exist', async () => {
    const { class_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id: 99999, // Non-existent subject
      class_id,
      daily_weight: 40,
      midterm_weight: 30,
      final_weight: 30,
      academic_year: '2024/2025'
    };

    await expect(createGradeConfig(testInput)).rejects.toThrow(/subject with id 99999 does not exist/i);
  });

  it('should throw error when class does not exist', async () => {
    const { subject_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id,
      class_id: 99999, // Non-existent class
      daily_weight: 40,
      midterm_weight: 30,
      final_weight: 30,
      academic_year: '2024/2025'
    };

    await expect(createGradeConfig(testInput)).rejects.toThrow(/class with id 99999 does not exist/i);
  });

  it('should throw error when weights do not add up to 100', async () => {
    const { subject_id, class_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id,
      class_id,
      daily_weight: 40,
      midterm_weight: 30,
      final_weight: 20, // Total = 90%
      academic_year: '2024/2025'
    };

    await expect(createGradeConfig(testInput)).rejects.toThrow(/grade weights must add up to 100%.*current total: 90%/i);
  });

  it('should throw error when weights exceed 100', async () => {
    const { subject_id, class_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id,
      class_id,
      daily_weight: 50,
      midterm_weight: 40,
      final_weight: 30, // Total = 120%
      academic_year: '2024/2025'
    };

    await expect(createGradeConfig(testInput)).rejects.toThrow(/grade weights must add up to 100%.*current total: 120%/i);
  });

  it('should create multiple configurations for different subjects in same class', async () => {
    const { class_id } = await setupTestData();
    
    // Create second subject
    const subject2Result = await db.insert(subjectsTable)
      .values({
        name: 'Science',
        code: 'SCI01'
      })
      .returning()
      .execute();

    const testInput1: CreateGradeConfigInput = {
      subject_id: subject2Result[0].id,
      class_id,
      daily_weight: 40,
      midterm_weight: 30,
      final_weight: 30,
      academic_year: '2024/2025'
    };

    const testInput2: CreateGradeConfigInput = {
      subject_id: subject2Result[0].id,
      class_id,
      daily_weight: 50,
      midterm_weight: 25,
      final_weight: 25,
      academic_year: '2024/2025'
    };

    const result1 = await createGradeConfig(testInput1);
    const result2 = await createGradeConfig(testInput2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.subject_id).toEqual(subject2Result[0].id);
    expect(result2.subject_id).toEqual(subject2Result[0].id);
    expect(result1.daily_weight).toEqual(40);
    expect(result2.daily_weight).toEqual(50);
  });

  it('should handle zero weights when other weights sum to 100', async () => {
    const { subject_id, class_id } = await setupTestData();
    
    const testInput: CreateGradeConfigInput = {
      subject_id,
      class_id,
      daily_weight: 0,
      midterm_weight: 50,
      final_weight: 50,
      academic_year: '2024/2025'
    };

    const result = await createGradeConfig(testInput);

    expect(result.daily_weight).toEqual(0);
    expect(result.midterm_weight).toEqual(50);
    expect(result.final_weight).toEqual(50);
  });
});