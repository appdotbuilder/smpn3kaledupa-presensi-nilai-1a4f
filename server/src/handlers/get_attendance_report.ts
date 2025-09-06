import { db } from '../db';
import { attendancesTable, studentsTable } from '../db/schema';
import { type AttendanceReportInput, type Attendance } from '../schema';
import { eq, and, gte, lte, SQL } from 'drizzle-orm';

export const getAttendanceReport = async (input: AttendanceReportInput): Promise<Attendance[]> => {
  try {
    // Convert dates to string format for database comparison
    const startDateStr = input.start_date.toISOString().split('T')[0];
    const endDateStr = input.end_date.toISOString().split('T')[0];

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Date range filter (required)
    conditions.push(gte(attendancesTable.date, startDateStr));
    conditions.push(lte(attendancesTable.date, endDateStr));

    // Class filter - filter by student's class
    if (input.class_id !== undefined) {
      conditions.push(eq(studentsTable.class_id, input.class_id));
    }

    // Student filter
    if (input.student_id !== undefined) {
      conditions.push(eq(attendancesTable.student_id, input.student_id));
    }

    // Subject filter
    if (input.subject_id !== undefined) {
      conditions.push(eq(attendancesTable.subject_id, input.subject_id));
    }

    // Build the complete query with all conditions
    const results = await db.select({
      id: attendancesTable.id,
      student_id: attendancesTable.student_id,
      subject_id: attendancesTable.subject_id,
      date: attendancesTable.date,
      status: attendancesTable.status,
      notes: attendancesTable.notes,
      recorded_by: attendancesTable.recorded_by,
      created_at: attendancesTable.created_at
    })
      .from(attendancesTable)
      .innerJoin(studentsTable, eq(attendancesTable.student_id, studentsTable.id))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(attendancesTable.date, studentsTable.id)
      .execute();

    // Convert date strings back to Date objects for return
    return results.map(result => ({
      ...result,
      date: new Date(result.date)
    }));
  } catch (error) {
    console.error('Attendance report generation failed:', error);
    throw error;
  }
};