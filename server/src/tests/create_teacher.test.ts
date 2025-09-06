import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, teachersTable } from '../db/schema';
import { type CreateTeacherInput, type CreateUserInput } from '../schema';
import { createTeacher } from '../handlers/create_teacher';
import { eq } from 'drizzle-orm';

// Test data
const testUser: CreateUserInput = {
  email: 'teacher@test.com',
  password: 'password123',
  name: 'Test Teacher',
  role: 'teacher'
};

const testTeacher: CreateTeacherInput = {
  user_id: 1, // Will be updated after user creation
  employee_number: 'EMP001'
};

describe('createTeacher', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a teacher successfully', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const teacherInput = { ...testTeacher, user_id: userResult[0].id };
    const result = await createTeacher(teacherInput);

    // Verify returned data
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.employee_number).toEqual('EMP001');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save teacher to database', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const teacherInput = { ...testTeacher, user_id: userResult[0].id };
    const result = await createTeacher(teacherInput);

    // Query database to verify teacher was saved
    const teachers = await db.select()
      .from(teachersTable)
      .where(eq(teachersTable.id, result.id))
      .execute();

    expect(teachers).toHaveLength(1);
    expect(teachers[0].user_id).toEqual(userResult[0].id);
    expect(teachers[0].employee_number).toEqual('EMP001');
    expect(teachers[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error if user does not exist', async () => {
    const teacherInput = { ...testTeacher, user_id: 999 };

    await expect(createTeacher(teacherInput)).rejects.toThrow(/User not found/i);
  });

  it('should throw error if user role is not teacher', async () => {
    // Create user with student role
    const studentUser = {
      ...testUser,
      role: 'student' as const
    };

    const userResult = await db.insert(usersTable)
      .values(studentUser)
      .returning()
      .execute();

    const teacherInput = { ...testTeacher, user_id: userResult[0].id };

    await expect(createTeacher(teacherInput)).rejects.toThrow(/User must have teacher role/i);
  });

  it('should throw error for duplicate employee number', async () => {
    // Create first teacher
    const userResult1 = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const teacherInput1 = { ...testTeacher, user_id: userResult1[0].id };
    await createTeacher(teacherInput1);

    // Create second user
    const secondUser = {
      ...testUser,
      email: 'teacher2@test.com'
    };

    const userResult2 = await db.insert(usersTable)
      .values(secondUser)
      .returning()
      .execute();

    // Try to create second teacher with same employee number
    const teacherInput2 = { ...testTeacher, user_id: userResult2[0].id };

    await expect(createTeacher(teacherInput2)).rejects.toThrow();
  });

  it('should work with admin role user', async () => {
    // Create user with admin role (admins can also be teachers)
    const adminUser = {
      ...testUser,
      role: 'admin' as const,
      email: 'admin@test.com'
    };

    const userResult = await db.insert(usersTable)
      .values(adminUser)
      .returning()
      .execute();

    const teacherInput = { ...testTeacher, user_id: userResult[0].id };
    
    // This should throw an error since we only allow teacher role
    await expect(createTeacher(teacherInput)).rejects.toThrow(/User must have teacher role/i);
  });

  it('should handle different employee number formats', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const teacherInput = {
      user_id: userResult[0].id,
      employee_number: 'T-2024-001'
    };

    const result = await createTeacher(teacherInput);

    expect(result.employee_number).toEqual('T-2024-001');
    expect(result.id).toBeDefined();
  });
});