import { db } from '../db';
import { attendancesTable, studentsTable, parentsTable, notificationsTable } from '../db/schema';
import { type CreateAttendanceInput, type Attendance } from '../schema';
import { eq } from 'drizzle-orm';

export const createAttendance = async (input: CreateAttendanceInput): Promise<Attendance> => {
  try {
    // Verify student exists
    const student = await db.select()
      .from(studentsTable)
      .where(eq(studentsTable.id, input.student_id))
      .execute();

    if (student.length === 0) {
      throw new Error(`Student with id ${input.student_id} not found`);
    }

    // Insert attendance record - convert Date to string for date column
    const dateString = input.date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
    const result = await db.insert(attendancesTable)
      .values({
        student_id: input.student_id,
        subject_id: input.subject_id,
        date: dateString,
        status: input.status,
        notes: input.notes,
        recorded_by: input.recorded_by
      })
      .returning()
      .execute();

    // Convert date string back to Date object
    const attendance = {
      ...result[0],
      date: new Date(result[0].date)
    };

    // If student is absent and has a parent, create notification
    if (input.status === 'absent' && student[0].parent_id) {
      const messageType = input.subject_id ? 'attendance' : 'attendance';
      const subjectText = input.subject_id ? 'subject class' : 'daily attendance';
      const message = `Your child was marked absent for ${subjectText} on ${input.date.toISOString().split('T')[0]}.`;

      await db.insert(notificationsTable)
        .values({
          parent_id: student[0].parent_id,
          student_id: input.student_id,
          message: message,
          type: messageType,
          status: 'pending'
        })
        .execute();
    }

    return attendance;
  } catch (error) {
    console.error('Attendance creation failed:', error);
    throw error;
  }
};