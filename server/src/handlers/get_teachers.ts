import { db } from '../db';
import { teachersTable, usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Teacher } from '../schema';

export const getTeachers = async (): Promise<Teacher[]> => {
  try {
    // Fetch all teachers from the database
    const results = await db.select()
      .from(teachersTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch teachers:', error);
    throw error;
  }
};