import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test inputs for different user roles
const adminInput: CreateUserInput = {
  email: 'admin@school.com',
  password: 'securepassword123',
  name: 'School Administrator',
  role: 'admin'
};

const teacherInput: CreateUserInput = {
  email: 'teacher@school.com',
  password: 'teacherpass456',
  name: 'John Teacher',
  role: 'teacher'
};

const studentInput: CreateUserInput = {
  email: 'student@school.com',
  password: 'studentpass789',
  name: 'Jane Student',
  role: 'student'
};

const parentInput: CreateUserInput = {
  email: 'parent@school.com',
  password: 'parentpass101',
  name: 'Mary Parent',
  role: 'parent'
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an admin user', async () => {
    const result = await createUser(adminInput);

    // Basic field validation
    expect(result.email).toEqual('admin@school.com');
    expect(result.name).toEqual('School Administrator');
    expect(result.role).toEqual('admin');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    
    // Password should be hashed (not equal to original)
    expect(result.password).not.toEqual('securepassword123');
    expect(result.password.length).toBeGreaterThan(20); // Hashed passwords are long
  });

  it('should create a teacher user', async () => {
    const result = await createUser(teacherInput);

    expect(result.email).toEqual('teacher@school.com');
    expect(result.name).toEqual('John Teacher');
    expect(result.role).toEqual('teacher');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a student user', async () => {
    const result = await createUser(studentInput);

    expect(result.email).toEqual('student@school.com');
    expect(result.name).toEqual('Jane Student');
    expect(result.role).toEqual('student');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a parent user', async () => {
    const result = await createUser(parentInput);

    expect(result.email).toEqual('parent@school.com');
    expect(result.name).toEqual('Mary Parent');
    expect(result.role).toEqual('parent');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(adminInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('admin@school.com');
    expect(users[0].name).toEqual('School Administrator');
    expect(users[0].role).toEqual('admin');
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
    
    // Verify password is hashed in database
    expect(users[0].password).not.toEqual('securepassword123');
    expect(users[0].password.length).toBeGreaterThan(20);
  });

  it('should hash password properly', async () => {
    const result = await createUser(adminInput);

    // Verify the hashed password can be verified
    const isValidPassword = await Bun.password.verify('securepassword123', result.password);
    expect(isValidPassword).toBe(true);

    // Verify wrong password fails
    const isWrongPassword = await Bun.password.verify('wrongpassword', result.password);
    expect(isWrongPassword).toBe(false);
  });

  it('should create multiple users with unique IDs', async () => {
    const admin = await createUser(adminInput);
    const teacher = await createUser(teacherInput);
    const student = await createUser(studentInput);

    expect(admin.id).not.toEqual(teacher.id);
    expect(teacher.id).not.toEqual(student.id);
    expect(admin.id).not.toEqual(student.id);

    // Verify all users are in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(3);
  });

  it('should enforce unique email constraint', async () => {
    await createUser(adminInput);

    // Attempt to create another user with same email
    const duplicateEmailInput: CreateUserInput = {
      email: 'admin@school.com', // Same email
      password: 'differentpassword',
      name: 'Different Name',
      role: 'teacher'
    };

    await expect(createUser(duplicateEmailInput)).rejects.toThrow(/unique/i);
  });

  it('should handle different password lengths', async () => {
    const shortPasswordInput: CreateUserInput = {
      email: 'short@school.com',
      password: 'abc123', // Minimum length
      name: 'Short Password User',
      role: 'student'
    };

    const longPasswordInput: CreateUserInput = {
      email: 'long@school.com',
      password: 'this-is-a-very-long-password-with-many-characters-123456789',
      name: 'Long Password User',
      role: 'parent'
    };

    const shortResult = await createUser(shortPasswordInput);
    const longResult = await createUser(longPasswordInput);

    expect(shortResult.id).toBeDefined();
    expect(longResult.id).toBeDefined();

    // Both should be properly hashed
    expect(shortResult.password.length).toBeGreaterThan(20);
    expect(longResult.password.length).toBeGreaterThan(20);

    // Verify both passwords can be verified
    const shortValid = await Bun.password.verify('abc123', shortResult.password);
    const longValid = await Bun.password.verify('this-is-a-very-long-password-with-many-characters-123456789', longResult.password);
    
    expect(shortValid).toBe(true);
    expect(longValid).toBe(true);
  });
});