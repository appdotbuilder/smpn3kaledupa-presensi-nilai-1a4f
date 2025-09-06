import { db } from '../db';
import { studentsTable } from '../db/schema';
import { type Student } from '../schema';

export const getStudents = async (): Promise<Student[]> => {
  try {
    const results = await db.select()
      .from(studentsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch students:', error);
    throw error;
  }
};