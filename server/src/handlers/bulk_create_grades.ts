import { db } from '../db';
import { gradesTable } from '../db/schema';
import { type BulkGradeInput, type Grade } from '../schema';

export const bulkCreateGrades = async (input: BulkGradeInput): Promise<Grade[]> => {
  try {
    // Handle empty grades array
    if (input.grades.length === 0) {
      return [];
    }

    // Insert all grades in a single transaction
    const result = await db.insert(gradesTable)
      .values(
        input.grades.map(grade => ({
          student_id: grade.student_id,
          subject_id: grade.subject_id,
          assignment_type: grade.assignment_type,
          assignment_name: grade.assignment_name,
          score: grade.score.toString(), // Convert number to string for numeric column
          max_score: grade.max_score.toString(), // Convert number to string for numeric column
          weight: grade.weight.toString(), // Convert number to string for numeric column
          date_recorded: grade.date_recorded.toISOString().split('T')[0], // Convert Date to date string
          recorded_by: grade.recorded_by
        }))
      )
      .returning()
      .execute();

    // Convert numeric fields back to numbers and date strings back to Date objects before returning
    return result.map(grade => ({
      ...grade,
      score: parseFloat(grade.score), // Convert string back to number
      max_score: parseFloat(grade.max_score), // Convert string back to number
      weight: parseFloat(grade.weight), // Convert string back to number
      date_recorded: new Date(grade.date_recorded) // Convert string back to Date
    }));
  } catch (error) {
    console.error('Bulk grade creation failed:', error);
    throw error;
  }
};