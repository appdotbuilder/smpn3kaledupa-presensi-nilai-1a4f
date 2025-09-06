import { db } from '../db';
import { teacherAssignmentsTable, teachersTable, subjectsTable, classesTable } from '../db/schema';
import { type CreateTeacherAssignmentInput, type TeacherAssignment } from '../schema';
import { eq } from 'drizzle-orm';

export const createTeacherAssignment = async (input: CreateTeacherAssignmentInput): Promise<TeacherAssignment> => {
  try {
    // Validate that teacher exists
    const teacher = await db.select()
      .from(teachersTable)
      .where(eq(teachersTable.id, input.teacher_id))
      .execute();

    if (teacher.length === 0) {
      throw new Error(`Teacher with id ${input.teacher_id} does not exist`);
    }

    // Validate that subject exists
    const subject = await db.select()
      .from(subjectsTable)
      .where(eq(subjectsTable.id, input.subject_id))
      .execute();

    if (subject.length === 0) {
      throw new Error(`Subject with id ${input.subject_id} does not exist`);
    }

    // Validate that class exists
    const classRecord = await db.select()
      .from(classesTable)
      .where(eq(classesTable.id, input.class_id))
      .execute();

    if (classRecord.length === 0) {
      throw new Error(`Class with id ${input.class_id} does not exist`);
    }

    // Insert teacher assignment record
    const result = await db.insert(teacherAssignmentsTable)
      .values({
        teacher_id: input.teacher_id,
        subject_id: input.subject_id,
        class_id: input.class_id,
        academic_year: input.academic_year
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Teacher assignment creation failed:', error);
    throw error;
  }
};