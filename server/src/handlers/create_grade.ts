import { db } from '../db';
import { gradesTable, studentsTable, subjectsTable, usersTable } from '../db/schema';
import { type CreateGradeInput, type Grade } from '../schema';
import { eq } from 'drizzle-orm';

export const createGrade = async (input: CreateGradeInput): Promise<Grade> => {
  try {
    // Verify that the student exists
    const student = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.id, input.student_id))
      .execute();
    
    if (student.length === 0) {
      throw new Error(`Student with id ${input.student_id} not found`);
    }

    // Verify that the subject exists
    const subject = await db.select()
      .from(subjectsTable)
      .where(eq(subjectsTable.id, input.subject_id))
      .execute();
    
    if (subject.length === 0) {
      throw new Error(`Subject with id ${input.subject_id} not found`);
    }

    // Verify that the user who is recording exists
    const recordedBy = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.recorded_by))
      .execute();
    
    if (recordedBy.length === 0) {
      throw new Error(`User with id ${input.recorded_by} not found`);
    }

    // Insert grade record - convert numeric fields to strings for database storage
    const result = await db.insert(gradesTable)
      .values({
        student_id: input.student_id,
        subject_id: input.subject_id,
        assignment_type: input.assignment_type,
        assignment_name: input.assignment_name,
        score: input.score.toString(), // Convert number to string for numeric column
        max_score: input.max_score.toString(), // Convert number to string for numeric column
        weight: input.weight.toString(), // Convert number to string for numeric column
        date_recorded: input.date_recorded.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        recorded_by: input.recorded_by
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers and date back to Date object
    const grade = result[0];
    return {
      ...grade,
      score: parseFloat(grade.score), // Convert string back to number
      max_score: parseFloat(grade.max_score), // Convert string back to number
      weight: parseFloat(grade.weight), // Convert string back to number
      date_recorded: new Date(grade.date_recorded) // Convert string back to Date
    };
  } catch (error) {
    console.error('Grade creation failed:', error);
    throw error;
  }
};