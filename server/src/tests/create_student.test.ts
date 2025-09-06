import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, classesTable, studentsTable, parentsTable } from '../db/schema';
import { type CreateStudentInput } from '../schema';
import { createStudent } from '../handlers/create_student';
import { eq } from 'drizzle-orm';

describe('createStudent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let studentUserId: number;
  let classId: number;
  let parentId: number;

  beforeEach(async () => {
    // Create a student user
    const studentUserResult = await db.insert(usersTable)
      .values({
        email: 'student@example.com',
        password: 'password123',
        name: 'John Doe',
        role: 'student'
      })
      .returning()
      .execute();
    studentUserId = studentUserResult[0].id;

    // Create a class
    const classResult = await db.insert(classesTable)
      .values({
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();
    classId = classResult[0].id;

    // Create a parent user and parent record
    const parentUserResult = await db.insert(usersTable)
      .values({
        email: 'parent@example.com',
        password: 'password123',
        name: 'Jane Doe',
        role: 'parent'
      })
      .returning()
      .execute();

    const parentResult = await db.insert(parentsTable)
      .values({
        user_id: parentUserResult[0].id,
        phone_number: '+1234567890'
      })
      .returning()
      .execute();
    parentId = parentResult[0].id;
  });

  it('should create a student with parent', async () => {
    const testInput: CreateStudentInput = {
      user_id: studentUserId,
      student_number: 'STU001',
      class_id: classId,
      parent_id: parentId
    };

    const result = await createStudent(testInput);

    // Basic field validation
    expect(result.user_id).toEqual(studentUserId);
    expect(result.student_number).toEqual('STU001');
    expect(result.class_id).toEqual(classId);
    expect(result.parent_id).toEqual(parentId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a student without parent', async () => {
    const testInput: CreateStudentInput = {
      user_id: studentUserId,
      student_number: 'STU002',
      class_id: classId,
      parent_id: null
    };

    const result = await createStudent(testInput);

    // Basic field validation
    expect(result.user_id).toEqual(studentUserId);
    expect(result.student_number).toEqual('STU002');
    expect(result.class_id).toEqual(classId);
    expect(result.parent_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save student to database', async () => {
    const testInput: CreateStudentInput = {
      user_id: studentUserId,
      student_number: 'STU003',
      class_id: classId,
      parent_id: parentId
    };

    const result = await createStudent(testInput);

    // Query database to verify record was created
    const students = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.id, result.id))
      .execute();

    expect(students).toHaveLength(1);
    expect(students[0].user_id).toEqual(studentUserId);
    expect(students[0].student_number).toEqual('STU003');
    expect(students[0].class_id).toEqual(classId);
    expect(students[0].parent_id).toEqual(parentId);
    expect(students[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent user', async () => {
    const testInput: CreateStudentInput = {
      user_id: 99999, // Non-existent user ID
      student_number: 'STU004',
      class_id: classId,
      parent_id: parentId
    };

    expect(createStudent(testInput)).rejects.toThrow(/User with id 99999 not found/);
  });

  it('should throw error for non-student user role', async () => {
    // Create a teacher user
    const teacherUserResult = await db.insert(usersTable)
      .values({
        email: 'teacher@example.com',
        password: 'password123',
        name: 'Teacher Smith',
        role: 'teacher'
      })
      .returning()
      .execute();

    const testInput: CreateStudentInput = {
      user_id: teacherUserResult[0].id,
      student_number: 'STU005',
      class_id: classId,
      parent_id: parentId
    };

    expect(createStudent(testInput)).rejects.toThrow(/is not a student/);
  });

  it('should throw error for non-existent class', async () => {
    const testInput: CreateStudentInput = {
      user_id: studentUserId,
      student_number: 'STU006',
      class_id: 99999, // Non-existent class ID
      parent_id: parentId
    };

    expect(createStudent(testInput)).rejects.toThrow(/Class with id 99999 not found/);
  });

  it('should throw error for non-existent parent', async () => {
    const testInput: CreateStudentInput = {
      user_id: studentUserId,
      student_number: 'STU007',
      class_id: classId,
      parent_id: 99999 // Non-existent parent ID
    };

    expect(createStudent(testInput)).rejects.toThrow(/Parent with id 99999 not found/);
  });

  it('should handle duplicate student number constraint', async () => {
    // Create first student
    const firstInput: CreateStudentInput = {
      user_id: studentUserId,
      student_number: 'STU008',
      class_id: classId,
      parent_id: parentId
    };

    await createStudent(firstInput);

    // Create second student user
    const secondUserResult = await db.insert(usersTable)
      .values({
        email: 'student2@example.com',
        password: 'password123',
        name: 'Jane Smith',
        role: 'student'
      })
      .returning()
      .execute();

    // Try to create second student with same student number
    const secondInput: CreateStudentInput = {
      user_id: secondUserResult[0].id,
      student_number: 'STU008', // Duplicate student number
      class_id: classId,
      parent_id: parentId
    };

    expect(createStudent(secondInput)).rejects.toThrow();
  });

  it('should handle different grade levels correctly', async () => {
    // Create a different class with higher grade level
    const grade9ClassResult = await db.insert(classesTable)
      .values({
        name: 'Class 9A',
        grade_level: 9,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    const testInput: CreateStudentInput = {
      user_id: studentUserId,
      student_number: 'STU009',
      class_id: grade9ClassResult[0].id,
      parent_id: parentId
    };

    const result = await createStudent(testInput);

    expect(result.class_id).toEqual(grade9ClassResult[0].id);
    expect(result.student_number).toEqual('STU009');
  });
});