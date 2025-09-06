import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { parentsTable, usersTable } from '../db/schema';
import { type CreateParentInput } from '../schema';
import { createParent } from '../handlers/create_parent';
import { eq } from 'drizzle-orm';

describe('createParent', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a parent successfully', async () => {
    // Create a user with parent role first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'parent@example.com',
        password: 'password123',
        name: 'John Parent',
        role: 'parent'
      })
      .returning()
      .execute();

    const testInput: CreateParentInput = {
      user_id: userResult[0].id,
      phone_number: '+1234567890'
    };

    const result = await createParent(testInput);

    // Verify basic fields
    expect(result.user_id).toEqual(userResult[0].id);
    expect(result.phone_number).toEqual('+1234567890');
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save parent to database', async () => {
    // Create a user with parent role first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'parent@example.com',
        password: 'password123',
        name: 'Jane Parent',
        role: 'parent'
      })
      .returning()
      .execute();

    const testInput: CreateParentInput = {
      user_id: userResult[0].id,
      phone_number: '+9876543210'
    };

    const result = await createParent(testInput);

    // Query the database to verify the parent was saved
    const parents = await db.select()
      .from(parentsTable)
      .where(eq(parentsTable.id, result.id))
      .execute();

    expect(parents).toHaveLength(1);
    expect(parents[0].user_id).toEqual(userResult[0].id);
    expect(parents[0].phone_number).toEqual('+9876543210');
    expect(parents[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const testInput: CreateParentInput = {
      user_id: 99999, // Non-existent user ID
      phone_number: '+1234567890'
    };

    await expect(createParent(testInput)).rejects.toThrow(/User with id 99999 does not exist/i);
  });

  it('should throw error when user does not have parent role', async () => {
    // Create a user with student role instead of parent
    const userResult = await db.insert(usersTable)
      .values({
        email: 'student@example.com',
        password: 'password123',
        name: 'Student User',
        role: 'student'
      })
      .returning()
      .execute();

    const testInput: CreateParentInput = {
      user_id: userResult[0].id,
      phone_number: '+1234567890'
    };

    await expect(createParent(testInput)).rejects.toThrow(/must have 'parent' role/i);
  });

  it('should work with different phone number formats', async () => {
    // Create a user with parent role
    const userResult = await db.insert(usersTable)
      .values({
        email: 'parent@example.com',
        password: 'password123',
        name: 'Parent User',
        role: 'parent'
      })
      .returning()
      .execute();

    const testInput: CreateParentInput = {
      user_id: userResult[0].id,
      phone_number: '0812-3456-7890'
    };

    const result = await createParent(testInput);

    expect(result.phone_number).toEqual('0812-3456-7890');
    expect(result.user_id).toEqual(userResult[0].id);
  });

  it('should handle foreign key constraint properly', async () => {
    // Create user with parent role first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'parent@example.com',
        password: 'password123',
        name: 'Parent User',
        role: 'parent'
      })
      .returning()
      .execute();

    const testInput: CreateParentInput = {
      user_id: userResult[0].id,
      phone_number: '+1234567890'
    };

    const result = await createParent(testInput);

    // Verify the foreign key relationship works
    const parentWithUser = await db.select({
      parentId: parentsTable.id,
      parentPhone: parentsTable.phone_number,
      userName: usersTable.name,
      userEmail: usersTable.email
    })
      .from(parentsTable)
      .innerJoin(usersTable, eq(parentsTable.user_id, usersTable.id))
      .where(eq(parentsTable.id, result.id))
      .execute();

    expect(parentWithUser).toHaveLength(1);
    expect(parentWithUser[0].parentPhone).toEqual('+1234567890');
    expect(parentWithUser[0].userName).toEqual('Parent User');
    expect(parentWithUser[0].userEmail).toEqual('parent@example.com');
  });
});