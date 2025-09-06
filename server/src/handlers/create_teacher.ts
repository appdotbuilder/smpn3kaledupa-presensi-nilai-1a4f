import { db } from '../db';
import { teachersTable, usersTable } from '../db/schema';
import { type CreateTeacherInput, type Teacher } from '../schema';
import { eq } from 'drizzle-orm';

export const createTeacher = async (input: CreateTeacherInput): Promise<Teacher> => {
  try {
    // Verify that the user exists and has the correct role
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    if (user[0].role !== 'teacher') {
      throw new Error('User must have teacher role');
    }

    // Insert teacher record
    const result = await db.insert(teachersTable)
      .values({
        user_id: input.user_id,
        employee_number: input.employee_number
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Teacher creation failed:', error);
    throw error;
  }
};