import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, studentsTable, classesTable, parentsTable } from '../db/schema';
import { getStudents } from '../handlers/get_students';

// Test data
const testUser = {
  email: 'student@test.com',
  password: 'password123',
  name: 'Test Student',
  role: 'student' as const
};

const testClass = {
  name: 'Class 7A',
  grade_level: 7,
  academic_year: '2024/2025'
};

const testParentUser = {
  email: 'parent@test.com',
  password: 'password123',
  name: 'Test Parent',
  role: 'parent' as const
};

describe('getStudents', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no students exist', async () => {
    const result = await getStudents();
    
    expect(result).toEqual([]);
  });

  it('should return all students', async () => {
    // Create user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    // Create class
    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    // Create student
    const studentInput = {
      user_id: user.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: null
    };

    const [expectedStudent] = await db.insert(studentsTable)
      .values(studentInput)
      .returning()
      .execute();

    const result = await getStudents();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(expectedStudent.id);
    expect(result[0].user_id).toEqual(user.id);
    expect(result[0].student_number).toEqual('STU001');
    expect(result[0].class_id).toEqual(testClassRecord.id);
    expect(result[0].parent_id).toBeNull();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return multiple students', async () => {
    // Create users
    const [user1] = await db.insert(usersTable)
      .values({
        email: 'student1@test.com',
        password: 'password123',
        name: 'Student One',
        role: 'student' as const
      })
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        email: 'student2@test.com',
        password: 'password123',
        name: 'Student Two',
        role: 'student' as const
      })
      .returning()
      .execute();

    // Create class
    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    // Create students
    await db.insert(studentsTable)
      .values([
        {
          user_id: user1.id,
          student_number: 'STU001',
          class_id: testClassRecord.id,
          parent_id: null
        },
        {
          user_id: user2.id,
          student_number: 'STU002',
          class_id: testClassRecord.id,
          parent_id: null
        }
      ])
      .execute();

    const result = await getStudents();

    expect(result).toHaveLength(2);
    
    // Check first student
    const student1 = result.find(s => s.student_number === 'STU001');
    expect(student1).toBeDefined();
    expect(student1!.user_id).toEqual(user1.id);
    expect(student1!.class_id).toEqual(testClassRecord.id);
    
    // Check second student
    const student2 = result.find(s => s.student_number === 'STU002');
    expect(student2).toBeDefined();
    expect(student2!.user_id).toEqual(user2.id);
    expect(student2!.class_id).toEqual(testClassRecord.id);
  });

  it('should return students with parent associations', async () => {
    // Create user and parent user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();

    const [parentUser] = await db.insert(usersTable)
      .values(testParentUser)
      .returning()
      .execute();

    // Create class
    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    // Create parent
    const [parent] = await db.insert(parentsTable)
      .values({
        user_id: parentUser.id,
        phone_number: '+1234567890'
      })
      .returning()
      .execute();

    // Create student with parent
    const studentInput = {
      user_id: user.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: parent.id
    };

    await db.insert(studentsTable)
      .values(studentInput)
      .returning()
      .execute();

    const result = await getStudents();

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toEqual(user.id);
    expect(result[0].parent_id).toEqual(parent.id);
    expect(result[0].student_number).toEqual('STU001');
    expect(result[0].class_id).toEqual(testClassRecord.id);
  });

  it('should handle students across different classes and grades', async () => {
    // Create users
    const [user1] = await db.insert(usersTable)
      .values({
        email: 'student1@test.com',
        password: 'password123',
        name: 'Student One',
        role: 'student' as const
      })
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        email: 'student2@test.com',
        password: 'password123',
        name: 'Student Two',
        role: 'student' as const
      })
      .returning()
      .execute();

    // Create classes
    const [class7A] = await db.insert(classesTable)
      .values({
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    const [class8B] = await db.insert(classesTable)
      .values({
        name: 'Class 8B',
        grade_level: 8,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    // Create students in different classes
    await db.insert(studentsTable)
      .values([
        {
          user_id: user1.id,
          student_number: 'STU001',
          class_id: class7A.id,
          parent_id: null
        },
        {
          user_id: user2.id,
          student_number: 'STU002',
          class_id: class8B.id,
          parent_id: null
        }
      ])
      .execute();

    const result = await getStudents();

    expect(result).toHaveLength(2);
    
    const student1 = result.find(s => s.student_number === 'STU001');
    expect(student1!.class_id).toEqual(class7A.id);
    
    const student2 = result.find(s => s.student_number === 'STU002');
    expect(student2!.class_id).toEqual(class8B.id);
  });

  it('should return students ordered by creation time', async () => {
    // Create users
    const [user1] = await db.insert(usersTable)
      .values({
        email: 'student1@test.com',
        password: 'password123',
        name: 'Student One',
        role: 'student' as const
      })
      .returning()
      .execute();

    const [user2] = await db.insert(usersTable)
      .values({
        email: 'student2@test.com',
        password: 'password123',
        name: 'Student Two',
        role: 'student' as const
      })
      .returning()
      .execute();

    // Create class
    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    // Create first student
    const [firstStudent] = await db.insert(studentsTable)
      .values({
        user_id: user1.id,
        student_number: 'STU001',
        class_id: testClassRecord.id,
        parent_id: null
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Create second student
    const [secondStudent] = await db.insert(studentsTable)
      .values({
        user_id: user2.id,
        student_number: 'STU002',
        class_id: testClassRecord.id,
        parent_id: null
      })
      .returning()
      .execute();

    const result = await getStudents();

    expect(result).toHaveLength(2);
    expect(firstStudent.created_at <= secondStudent.created_at).toBe(true);
  });
});