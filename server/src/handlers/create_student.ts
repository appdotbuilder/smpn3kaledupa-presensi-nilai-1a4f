import { db } from '../db';
import { studentsTable, usersTable, classesTable, parentsTable } from '../db/schema';
import { type CreateStudentInput, type Student } from '../schema';
import { eq } from 'drizzle-orm';

export const createStudent = async (input: CreateStudentInput): Promise<Student> => {
  try {
    // Verify that the user exists and has the correct role
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    if (user[0].role !== 'student') {
      throw new Error(`User with id ${input.user_id} is not a student`);
    }

    // Verify that the class exists
    const classRecord = await db.select()
      .from(classesTable)
      .where(eq(classesTable.id, input.class_id))
      .execute();

    if (classRecord.length === 0) {
      throw new Error(`Class with id ${input.class_id} not found`);
    }

    // If parent_id is provided, verify that the parent exists
    if (input.parent_id) {
      const parent = await db.select()
        .from(parentsTable)
        .where(eq(parentsTable.id, input.parent_id))
        .execute();

      if (parent.length === 0) {
        throw new Error(`Parent with id ${input.parent_id} not found`);
      }
    }

    // Insert student record
    const result = await db.insert(studentsTable)
      .values({
        user_id: input.user_id,
        student_number: input.student_number,
        class_id: input.class_id,
        parent_id: input.parent_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Student creation failed:', error);
    throw error;
  }
};