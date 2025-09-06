import { db } from '../db';
import { classesTable } from '../db/schema';
import { type Class } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';
import { z } from 'zod';

// Input schema for filtering classes
export const getClassesInputSchema = z.object({
  academic_year: z.string().optional(),
  grade_level: z.number().int().min(7).max(9).optional()
});

export type GetClassesInput = z.infer<typeof getClassesInputSchema>;

export const getClasses = async (input: GetClassesInput = {}): Promise<Class[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (input.academic_year !== undefined) {
      conditions.push(eq(classesTable.academic_year, input.academic_year));
    }

    if (input.grade_level !== undefined) {
      conditions.push(eq(classesTable.grade_level, input.grade_level));
    }

    // Build query based on whether we have conditions
    let results;
    if (conditions.length === 0) {
      // No filters - get all classes
      results = await db.select()
        .from(classesTable)
        .orderBy(classesTable.grade_level, classesTable.name)
        .execute();
    } else {
      // Apply filters
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      results = await db.select()
        .from(classesTable)
        .where(whereCondition)
        .orderBy(classesTable.grade_level, classesTable.name)
        .execute();
    }

    return results;
  } catch (error) {
    console.error('Failed to fetch classes:', error);
    throw error;
  }
};