import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, studentsTable, parentsTable, classesTable } from '../db/schema';
import { type ImportStudentsInput } from '../schema';
import { importStudents } from '../handlers/import_students';
import { eq, and } from 'drizzle-orm';

describe('importStudents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testClassId: number;

  beforeEach(async () => {
    // Create test class
    const classResult = await db.insert(classesTable)
      .values({
        name: 'Test Class',
        grade_level: 7,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();
    
    testClassId = classResult[0].id;
  });

  it('should import students without parents', async () => {
    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'John Doe',
          email: 'john.doe@student.com',
          student_number: 'S001'
        },
        {
          name: 'Jane Smith',
          email: 'jane.smith@student.com',
          student_number: 'S002'
        }
      ]
    };

    const result = await importStudents(input);

    expect(result).toHaveLength(2);
    
    // Verify first student
    expect(result[0].student_number).toBe('S001');
    expect(result[0].class_id).toBe(testClassId);
    expect(result[0].parent_id).toBeNull();
    expect(result[0].id).toBeDefined();
    expect(result[0].user_id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Verify second student
    expect(result[1].student_number).toBe('S002');
    expect(result[1].class_id).toBe(testClassId);
    expect(result[1].parent_id).toBeNull();

    // Verify users were created
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.role, 'student'))
      .execute();

    expect(users).toHaveLength(2);
    expect(users[0].name).toBe('John Doe');
    expect(users[0].email).toBe('john.doe@student.com');
    expect(users[0].role).toBe('student');
    expect(users[1].name).toBe('Jane Smith');
    expect(users[1].email).toBe('jane.smith@student.com');
    expect(users[1].role).toBe('student');
  });

  it('should import students with parents', async () => {
    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'Alice Johnson',
          email: 'alice.johnson@student.com',
          student_number: 'S003',
          parent_name: 'Bob Johnson',
          parent_email: 'bob.johnson@parent.com',
          parent_phone: '+1234567890'
        }
      ]
    };

    const result = await importStudents(input);

    expect(result).toHaveLength(1);
    expect(result[0].student_number).toBe('S003');
    expect(result[0].class_id).toBe(testClassId);
    expect(result[0].parent_id).toBeDefined();

    // Verify parent user was created
    const parentUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.role, 'parent'))
      .execute();

    expect(parentUsers).toHaveLength(1);
    expect(parentUsers[0].name).toBe('Bob Johnson');
    expect(parentUsers[0].email).toBe('bob.johnson@parent.com');
    expect(parentUsers[0].role).toBe('parent');

    // Verify parent record was created
    const parents = await db.select()
      .from(parentsTable)
      .where(eq(parentsTable.user_id, parentUsers[0].id))
      .execute();

    expect(parents).toHaveLength(1);
    expect(parents[0].phone_number).toBe('+1234567890');
    expect(parents[0].id).toBe(result[0].parent_id!);
  });

  it('should link to existing parent if email already exists', async () => {
    // Create existing parent first
    const existingParentUser = await db.insert(usersTable)
      .values({
        email: 'existing.parent@parent.com',
        password: 'password123',
        name: 'Existing Parent',
        role: 'parent'
      })
      .returning()
      .execute();

    const existingParent = await db.insert(parentsTable)
      .values({
        user_id: existingParentUser[0].id,
        phone_number: '+9876543210'
      })
      .returning()
      .execute();

    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'Child One',
          email: 'child.one@student.com',
          student_number: 'S004',
          parent_name: 'Different Name', // This should be ignored
          parent_email: 'existing.parent@parent.com',
          parent_phone: '+1111111111' // This should be ignored
        }
      ]
    };

    const result = await importStudents(input);

    expect(result).toHaveLength(1);
    expect(result[0].parent_id).toBe(existingParent[0].id);

    // Verify no duplicate parent users were created
    const parentUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.role, 'parent'))
      .execute();

    expect(parentUsers).toHaveLength(1);
    expect(parentUsers[0].name).toBe('Existing Parent'); // Original name preserved
  });

  it('should handle partial parent data by not creating parent', async () => {
    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'Orphan Student',
          email: 'orphan@student.com',
          student_number: 'S005',
          parent_name: 'Some Parent',
          // Missing parent_email and parent_phone
        }
      ]
    };

    const result = await importStudents(input);

    expect(result).toHaveLength(1);
    expect(result[0].parent_id).toBeNull();

    // Verify no parent users were created
    const parentUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.role, 'parent'))
      .execute();

    expect(parentUsers).toHaveLength(0);
  });

  it('should throw error for non-existent class', async () => {
    const input: ImportStudentsInput = {
      class_id: 99999, // Non-existent class
      students: [
        {
          name: 'Student',
          email: 'student@test.com',
          student_number: 'S999'
        }
      ]
    };

    await expect(importStudents(input)).rejects.toThrow(/Class with ID 99999 does not exist/);
  });

  it('should throw error for duplicate student number', async () => {
    // Create existing student first
    const existingUser = await db.insert(usersTable)
      .values({
        email: 'existing@student.com',
        password: 'password123',
        name: 'Existing Student',
        role: 'student'
      })
      .returning()
      .execute();

    await db.insert(studentsTable)
      .values({
        user_id: existingUser[0].id,
        student_number: 'DUPLICATE123',
        class_id: testClassId,
        parent_id: null
      })
      .execute();

    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'New Student',
          email: 'new@student.com',
          student_number: 'DUPLICATE123'
        }
      ]
    };

    await expect(importStudents(input)).rejects.toThrow(/Student with number DUPLICATE123 already exists/);
  });

  it('should throw error for duplicate student email', async () => {
    // Create existing user first
    await db.insert(usersTable)
      .values({
        email: 'duplicate@student.com',
        password: 'password123',
        name: 'Existing User',
        role: 'student'
      })
      .execute();

    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'New Student',
          email: 'duplicate@student.com',
          student_number: 'S006'
        }
      ]
    };

    await expect(importStudents(input)).rejects.toThrow(/User with email duplicate@student.com already exists/);
  });

  it('should stop processing on first error and provide detailed error message', async () => {
    // Create existing student
    const existingUser = await db.insert(usersTable)
      .values({
        email: 'existing@student.com',
        password: 'password123',
        name: 'Existing Student',
        role: 'student'
      })
      .returning()
      .execute();

    await db.insert(studentsTable)
      .values({
        user_id: existingUser[0].id,
        student_number: 'EXISTING123',
        class_id: testClassId,
        parent_id: null
      })
      .execute();

    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'Valid Student',
          email: 'valid@student.com',
          student_number: 'S007'
        },
        {
          name: 'Duplicate Student',
          email: 'duplicate@student.com',
          student_number: 'EXISTING123' // This will cause error
        },
        {
          name: 'Another Student',
          email: 'another@student.com',
          student_number: 'S008'
        }
      ]
    };

    await expect(importStudents(input)).rejects.toThrow(/Failed to import student Duplicate Student.*Student with number EXISTING123 already exists/);

    // Verify only the first valid student was created
    const students = await db.select()
      .from(studentsTable)
      .execute();

    // Should have 2 total: 1 existing + 1 valid before error
    expect(students).toHaveLength(2);
    expect(students.some(s => s.student_number === 'S007')).toBe(true);
    expect(students.some(s => s.student_number === 'S008')).toBe(false); // Should not be created
  });

  it('should create proper user accounts with default passwords', async () => {
    const input: ImportStudentsInput = {
      class_id: testClassId,
      students: [
        {
          name: 'Test Student',
          email: 'test@student.com',
          student_number: 'S010',
          parent_name: 'Test Parent',
          parent_email: 'test@parent.com',
          parent_phone: '+1234567890'
        }
      ]
    };

    const result = await importStudents(input);

    // Verify student user account
    const studentUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, 'test@student.com'))
      .execute();

    expect(studentUser).toHaveLength(1);
    expect(studentUser[0].password).toBe('temp123');
    expect(studentUser[0].role).toBe('student');

    // Verify parent user account
    const parentUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, 'test@parent.com'))
      .execute();

    expect(parentUser).toHaveLength(1);
    expect(parentUser[0].password).toBe('temp123');
    expect(parentUser[0].role).toBe('parent');
  });
});