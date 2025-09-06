import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all users when users exist', async () => {
    // Create test users
    const testUsers: CreateUserInput[] = [
      {
        email: 'admin@school.com',
        password: 'password123',
        name: 'Admin User',
        role: 'admin'
      },
      {
        email: 'teacher@school.com',
        password: 'password123',
        name: 'Teacher User',
        role: 'teacher'
      },
      {
        email: 'student@school.com',
        password: 'password123',
        name: 'Student User',
        role: 'student'
      }
    ];

    // Insert users directly into database
    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    
    // Verify all users are returned with proper structure
    const emails = result.map(user => user.email);
    expect(emails).toContain('admin@school.com');
    expect(emails).toContain('teacher@school.com');
    expect(emails).toContain('student@school.com');

    // Check that all required fields are present
    result.forEach(user => {
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('number');
      expect(user.email).toBeDefined();
      expect(user.password).toBeDefined();
      expect(user.name).toBeDefined();
      expect(user.role).toBeDefined();
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return users with different roles', async () => {
    // Create users with all possible roles
    const testUsers = [
      {
        email: 'admin@school.com',
        password: 'password123',
        name: 'Admin User',
        role: 'admin' as const
      },
      {
        email: 'teacher@school.com',
        password: 'password123',
        name: 'Teacher User',
        role: 'teacher' as const
      },
      {
        email: 'student@school.com',
        password: 'password123',
        name: 'Student User',
        role: 'student' as const
      },
      {
        email: 'parent@school.com',
        password: 'password123',
        name: 'Parent User',
        role: 'parent' as const
      }
    ];

    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(4);
    
    const roles = result.map(user => user.role);
    expect(roles).toContain('admin');
    expect(roles).toContain('teacher');
    expect(roles).toContain('student');
    expect(roles).toContain('parent');
  });

  it('should return users in consistent order', async () => {
    // Create multiple users
    const testUsers = [
      {
        email: 'user1@school.com',
        password: 'password123',
        name: 'User One',
        role: 'student' as const
      },
      {
        email: 'user2@school.com',
        password: 'password123',
        name: 'User Two',
        role: 'teacher' as const
      },
      {
        email: 'user3@school.com',
        password: 'password123',
        name: 'User Three',
        role: 'admin' as const
      }
    ];

    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    // Get users multiple times and verify consistent ordering
    const result1 = await getUsers();
    const result2 = await getUsers();

    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(3);
    
    // IDs should be in the same order (natural database ordering)
    const ids1 = result1.map(user => user.id);
    const ids2 = result2.map(user => user.id);
    expect(ids1).toEqual(ids2);
  });

  it('should handle users with special characters in names and emails', async () => {
    const testUser = {
      email: 'user+test@school-domain.co.id',
      password: 'password123',
      name: 'User O\'Malley-Smith',
      role: 'teacher' as const
    };

    await db.insert(usersTable)
      .values([testUser])
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('user+test@school-domain.co.id');
    expect(result[0].name).toBe('User O\'Malley-Smith');
    expect(result[0].role).toBe('teacher');
  });
});