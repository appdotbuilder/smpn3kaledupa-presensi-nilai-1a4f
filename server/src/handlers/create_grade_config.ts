import { db } from '../db';
import { gradeConfigsTable, subjectsTable, classesTable } from '../db/schema';
import { type CreateGradeConfigInput, type GradeConfig } from '../schema';
import { eq } from 'drizzle-orm';

export const createGradeConfig = async (input: CreateGradeConfigInput): Promise<GradeConfig> => {
  try {
    // Verify that subject exists
    const subject = await db.select()
      .from(subjectsTable)
      .where(eq(subjectsTable.id, input.subject_id))
      .execute();

    if (subject.length === 0) {
      throw new Error(`Subject with id ${input.subject_id} does not exist`);
    }

    // Verify that class exists
    const classRecord = await db.select()
      .from(classesTable)
      .where(eq(classesTable.id, input.class_id))
      .execute();

    if (classRecord.length === 0) {
      throw new Error(`Class with id ${input.class_id} does not exist`);
    }

    // Validate that weights add up to 100
    const totalWeight = input.daily_weight + input.midterm_weight + input.final_weight;
    if (totalWeight !== 100) {
      throw new Error(`Grade weights must add up to 100%. Current total: ${totalWeight}%`);
    }

    // Insert grade configuration record
    const result = await db.insert(gradeConfigsTable)
      .values({
        subject_id: input.subject_id,
        class_id: input.class_id,
        daily_weight: input.daily_weight.toString(),
        midterm_weight: input.midterm_weight.toString(),
        final_weight: input.final_weight.toString(),
        academic_year: input.academic_year
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const gradeConfig = result[0];
    return {
      ...gradeConfig,
      daily_weight: parseFloat(gradeConfig.daily_weight),
      midterm_weight: parseFloat(gradeConfig.midterm_weight),
      final_weight: parseFloat(gradeConfig.final_weight)
    };
  } catch (error) {
    console.error('Grade configuration creation failed:', error);
    throw error;
  }
};