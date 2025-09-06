import { db } from '../db';
import { parentsTable, usersTable } from '../db/schema';
import { type CreateParentInput, type Parent } from '../schema';
import { eq } from 'drizzle-orm';

export const createParent = async (input: CreateParentInput): Promise<Parent> => {
  try {
    // Verify that the user exists and has the 'parent' role
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} does not exist`);
    }

    if (user[0].role !== 'parent') {
      throw new Error(`User with id ${input.user_id} must have 'parent' role`);
    }

    // Insert parent record
    const result = await db.insert(parentsTable)
      .values({
        user_id: input.user_id,
        phone_number: input.phone_number
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Parent creation failed:', error);
    throw error;
  }
};