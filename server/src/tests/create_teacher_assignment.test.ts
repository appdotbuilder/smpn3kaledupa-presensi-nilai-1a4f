import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, teachersTable, subjectsTable, classesTable, teacherAssignmentsTable } from '../db/schema';
import { type CreateTeacherAssignmentInput } from '../schema';
import { createTeacherAssignment } from '../handlers/create_teacher_assignment';
import { eq } from 'drizzle-orm';

describe('createTeacherAssignment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  const createTestData = async () => {
    // Create user for teacher
    const users = await db.insert(usersTable)
      .values({
        email: 'teacher@example.com',
        password: 'password123',
        name: 'Test Teacher',
        role: 'teacher'
      })
      .returning()
      .execute();

    // Create teacher
    const teachers = await db.insert(teachersTable)
      .values({
        user_id: users[0].id,
        employee_number: 'T001'
      })
      .returning()
      .execute();

    // Create subject
    const subjects = await db.insert(subjectsTable)
      .values({
        name: 'Mathematics',
        code: 'MATH'
      })
      .returning()
      .execute();

    // Create class
    const classes = await db.insert(classesTable)
      .values({
        name: '8A',
        grade_level: 8,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    return {
      teacher: teachers[0],
      subject: subjects[0],
      class: classes[0]
    };
  };

  const testInput: CreateTeacherAssignmentInput = {
    teacher_id: 1,
    subject_id: 1,
    class_id: 1,
    academic_year: '2024/2025'
  };

  it('should create a teacher assignment', async () => {
    const testData = await createTestData();
    
    const input = {
      ...testInput,
      teacher_id: testData.teacher.id,
      subject_id: testData.subject.id,
      class_id: testData.class.id
    };

    const result = await createTeacherAssignment(input);

    // Basic field validation
    expect(result.teacher_id).toEqual(testData.teacher.id);
    expect(result.subject_id).toEqual(testData.subject.id);
    expect(result.class_id).toEqual(testData.class.id);
    expect(result.academic_year).toEqual('2024/2025');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save teacher assignment to database', async () => {
    const testData = await createTestData();
    
    const input = {
      ...testInput,
      teacher_id: testData.teacher.id,
      subject_id: testData.subject.id,
      class_id: testData.class.id
    };

    const result = await createTeacherAssignment(input);

    // Query using proper drizzle syntax
    const assignments = await db.select()
      .from(teacherAssignmentsTable)
      .where(eq(teacherAssignmentsTable.id, result.id))
      .execute();

    expect(assignments).toHaveLength(1);
    expect(assignments[0].teacher_id).toEqual(testData.teacher.id);
    expect(assignments[0].subject_id).toEqual(testData.subject.id);
    expect(assignments[0].class_id).toEqual(testData.class.id);
    expect(assignments[0].academic_year).toEqual('2024/2025');
    expect(assignments[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error when teacher does not exist', async () => {
    const testData = await createTestData();
    
    const input = {
      ...testInput,
      teacher_id: 999, // Non-existent teacher
      subject_id: testData.subject.id,
      class_id: testData.class.id
    };

    await expect(createTeacherAssignment(input)).rejects.toThrow(/Teacher with id 999 does not exist/i);
  });

  it('should throw error when subject does not exist', async () => {
    const testData = await createTestData();
    
    const input = {
      ...testInput,
      teacher_id: testData.teacher.id,
      subject_id: 999, // Non-existent subject
      class_id: testData.class.id
    };

    await expect(createTeacherAssignment(input)).rejects.toThrow(/Subject with id 999 does not exist/i);
  });

  it('should throw error when class does not exist', async () => {
    const testData = await createTestData();
    
    const input = {
      ...testInput,
      teacher_id: testData.teacher.id,
      subject_id: testData.subject.id,
      class_id: 999 // Non-existent class
    };

    await expect(createTeacherAssignment(input)).rejects.toThrow(/Class with id 999 does not exist/i);
  });

  it('should handle multiple teacher assignments for same teacher', async () => {
    const testData = await createTestData();

    // Create second subject
    const secondSubject = await db.insert(subjectsTable)
      .values({
        name: 'Physics',
        code: 'PHYS'
      })
      .returning()
      .execute();

    const firstInput = {
      ...testInput,
      teacher_id: testData.teacher.id,
      subject_id: testData.subject.id,
      class_id: testData.class.id
    };

    const secondInput = {
      ...testInput,
      teacher_id: testData.teacher.id,
      subject_id: secondSubject[0].id,
      class_id: testData.class.id
    };

    const firstResult = await createTeacherAssignment(firstInput);
    const secondResult = await createTeacherAssignment(secondInput);

    // Both assignments should be created successfully
    expect(firstResult.id).toBeDefined();
    expect(secondResult.id).toBeDefined();
    expect(firstResult.id).not.toEqual(secondResult.id);

    // Verify both exist in database
    const assignments = await db.select()
      .from(teacherAssignmentsTable)
      .where(eq(teacherAssignmentsTable.teacher_id, testData.teacher.id))
      .execute();

    expect(assignments).toHaveLength(2);
  });

  it('should create assignment with different academic years', async () => {
    const testData = await createTestData();
    
    const input = {
      ...testInput,
      teacher_id: testData.teacher.id,
      subject_id: testData.subject.id,
      class_id: testData.class.id,
      academic_year: '2023/2024'
    };

    const result = await createTeacherAssignment(input);

    expect(result.academic_year).toEqual('2023/2024');
    expect(result.teacher_id).toEqual(testData.teacher.id);
    expect(result.subject_id).toEqual(testData.subject.id);
    expect(result.class_id).toEqual(testData.class.id);
  });
});