import { db } from '../db';
import { gradesTable, studentsTable, subjectsTable } from '../db/schema';
import { type GradeReportInput, type Grade } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export const getGradeReport = async (input: GradeReportInput): Promise<Grade[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Filter by student_id if provided
    if (input.student_id !== undefined) {
      conditions.push(eq(gradesTable.student_id, input.student_id));
    }

    // Filter by subject_id if provided
    if (input.subject_id !== undefined) {
      conditions.push(eq(gradesTable.subject_id, input.subject_id));
    }

    // Filter by class_id if provided (through student's class)
    if (input.class_id !== undefined) {
      conditions.push(eq(studentsTable.class_id, input.class_id));
    }

    // Build the query with conditions
    const baseQuery = db.select()
      .from(gradesTable)
      .innerJoin(studentsTable, eq(gradesTable.student_id, studentsTable.id))
      .innerJoin(subjectsTable, eq(gradesTable.subject_id, subjectsTable.id));

    // Execute query with or without conditions
    const results = conditions.length > 0 
      ? await baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions)).execute()
      : await baseQuery.execute();

    // Transform results to Grade objects with proper numeric conversions
    return results.map(result => ({
      id: result.grades.id,
      student_id: result.grades.student_id,
      subject_id: result.grades.subject_id,
      assignment_type: result.grades.assignment_type,
      assignment_name: result.grades.assignment_name,
      score: parseFloat(result.grades.score), // Convert numeric to number
      max_score: parseFloat(result.grades.max_score), // Convert numeric to number
      weight: parseFloat(result.grades.weight), // Convert numeric to number
      date_recorded: new Date(result.grades.date_recorded), // Ensure Date object
      recorded_by: result.grades.recorded_by,
      created_at: result.grades.created_at
    }));
  } catch (error) {
    console.error('Grade report generation failed:', error);
    throw error;
  }
};