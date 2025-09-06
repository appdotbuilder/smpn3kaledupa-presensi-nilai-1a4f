import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, teachersTable } from '../db/schema';
import { getTeachers } from '../handlers/get_teachers';
import { type CreateUserInput, type CreateTeacherInput } from '../schema';

// Test data
const testUser1: CreateUserInput = {
  email: 'teacher1@school.com',
  password: 'password123',
  name: 'John Teacher',
  role: 'teacher'
};

const testUser2: CreateUserInput = {
  email: 'teacher2@school.com',
  password: 'password456',
  name: 'Jane Educator',
  role: 'teacher'
};

const testUser3: CreateUserInput = {
  email: 'admin@school.com',
  password: 'admin123',
  name: 'Admin User',
  role: 'admin'
};

describe('getTeachers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no teachers exist', async () => {
    const result = await getTeachers();
    expect(result).toEqual([]);
  });

  it('should fetch single teacher', async () => {
    // Create a user
    const userResult = await db.insert(usersTable)
      .values({
        email: testUser1.email,
        password: testUser1.password,
        name: testUser1.name,
        role: testUser1.role
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a teacher
    const teacherInput: CreateTeacherInput = {
      user_id: user.id,
      employee_number: 'T001'
    };

    await db.insert(teachersTable)
      .values({
        user_id: teacherInput.user_id,
        employee_number: teacherInput.employee_number
      })
      .execute();

    const result = await getTeachers();

    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(user.id);
    expect(result[0].employee_number).toBe('T001');
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should fetch multiple teachers', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        {
          email: testUser1.email,
          password: testUser1.password,
          name: testUser1.name,
          role: testUser1.role
        },
        {
          email: testUser2.email,
          password: testUser2.password,
          name: testUser2.name,
          role: testUser2.role
        }
      ])
      .returning()
      .execute();

    // Create teachers
    await db.insert(teachersTable)
      .values([
        {
          user_id: users[0].id,
          employee_number: 'T001'
        },
        {
          user_id: users[1].id,
          employee_number: 'T002'
        }
      ])
      .execute();

    const result = await getTeachers();

    expect(result).toHaveLength(2);
    
    // Check first teacher
    const teacher1 = result.find(t => t.employee_number === 'T001');
    expect(teacher1).toBeDefined();
    expect(teacher1!.user_id).toBe(users[0].id);

    // Check second teacher
    const teacher2 = result.find(t => t.employee_number === 'T002');
    expect(teacher2).toBeDefined();
    expect(teacher2!.user_id).toBe(users[1].id);
  });

  it('should return all teacher records regardless of associated user roles', async () => {
    // Create users with different roles
    const users = await db.insert(usersTable)
      .values([
        {
          email: testUser1.email,
          password: testUser1.password,
          name: testUser1.name,
          role: testUser1.role
        },
        {
          email: testUser3.email,
          password: testUser3.password,
          name: testUser3.name,
          role: testUser3.role // This is admin role
        }
      ])
      .returning()
      .execute();

    // Create teacher records (even if user has admin role)
    await db.insert(teachersTable)
      .values([
        {
          user_id: users[0].id,
          employee_number: 'T001'
        },
        {
          user_id: users[1].id,
          employee_number: 'T002'
        }
      ])
      .execute();

    const result = await getTeachers();

    expect(result).toHaveLength(2);
    expect(result.map(t => t.employee_number).sort()).toEqual(['T001', 'T002']);
  });

  it('should handle teachers with unique employee numbers', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        {
          email: testUser1.email,
          password: testUser1.password,
          name: testUser1.name,
          role: testUser1.role
        },
        {
          email: testUser2.email,
          password: testUser2.password,
          name: testUser2.name,
          role: testUser2.role
        }
      ])
      .returning()
      .execute();

    // Create teachers with different employee numbers
    await db.insert(teachersTable)
      .values([
        {
          user_id: users[0].id,
          employee_number: 'MATH001'
        },
        {
          user_id: users[1].id,
          employee_number: 'SCI002'
        }
      ])
      .execute();

    const result = await getTeachers();

    expect(result).toHaveLength(2);
    
    const employeeNumbers = result.map(t => t.employee_number).sort();
    expect(employeeNumbers).toEqual(['MATH001', 'SCI002']);
    
    // Verify each teacher has required fields
    result.forEach(teacher => {
      expect(teacher.user_id).toBeDefined();
      expect(teacher.employee_number).toBeDefined();
      expect(teacher.id).toBeDefined();
      expect(teacher.created_at).toBeInstanceOf(Date);
    });
  });

  it('should return teachers with proper field types', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: testUser1.email,
        password: testUser1.password,
        name: testUser1.name,
        role: testUser1.role
      })
      .returning()
      .execute();

    // Create teacher
    await db.insert(teachersTable)
      .values({
        user_id: userResult[0].id,
        employee_number: 'T001'
      })
      .execute();

    const result = await getTeachers();

    expect(result).toHaveLength(1);
    const teacher = result[0];
    
    // Verify field types
    expect(typeof teacher.id).toBe('number');
    expect(typeof teacher.user_id).toBe('number');
    expect(typeof teacher.employee_number).toBe('string');
    expect(teacher.created_at).toBeInstanceOf(Date);
  });

  it('should verify teachers are saved to database correctly', async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        {
          email: testUser1.email,
          password: testUser1.password,
          name: testUser1.name,
          role: testUser1.role
        },
        {
          email: testUser2.email,
          password: testUser2.password,
          name: testUser2.name,
          role: testUser2.role
        }
      ])
      .returning()
      .execute();

    // Create teachers
    const teacherInserts = await db.insert(teachersTable)
      .values([
        {
          user_id: users[0].id,
          employee_number: 'T001'
        },
        {
          user_id: users[1].id,
          employee_number: 'T002'
        }
      ])
      .returning()
      .execute();

    const result = await getTeachers();

    expect(result).toHaveLength(2);
    
    // Verify that the returned teachers match what was inserted
    teacherInserts.forEach(insertedTeacher => {
      const foundTeacher = result.find(t => t.id === insertedTeacher.id);
      expect(foundTeacher).toBeDefined();
      expect(foundTeacher!.user_id).toBe(insertedTeacher.user_id);
      expect(foundTeacher!.employee_number).toBe(insertedTeacher.employee_number);
      expect(foundTeacher!.created_at).toEqual(insertedTeacher.created_at);
    });
  });
});