import { db } from '../db';
import { attendancesTable, notificationsTable, studentsTable, parentsTable } from '../db/schema';
import { type BulkAttendanceInput, type Attendance } from '../schema';
import { eq } from 'drizzle-orm';

export const bulkCreateAttendance = async (input: BulkAttendanceInput): Promise<Attendance[]> => {
  try {
    // Validate that all students exist before creating attendance records
    const studentIds = input.attendances.map(a => a.student_id);
    const existingStudents = await db.select({ id: studentsTable.id })
      .from(studentsTable)
      .execute();

    const existingStudentIds = new Set(existingStudents.map(s => s.id));
    const invalidStudentIds = studentIds.filter(id => !existingStudentIds.has(id));
    
    if (invalidStudentIds.length > 0) {
      throw new Error(`Invalid student IDs: ${invalidStudentIds.join(', ')}`);
    }

    // Insert all attendance records
    const attendanceRecords = input.attendances.map(attendance => ({
      student_id: attendance.student_id,
      subject_id: attendance.subject_id,
      date: attendance.date.toISOString().split('T')[0], // Convert to date string
      status: attendance.status,
      notes: attendance.notes,
      recorded_by: attendance.recorded_by
    }));

    const results = await db.insert(attendancesTable)
      .values(attendanceRecords)
      .returning()
      .execute();

    // Create notifications for absent students
    const absentAttendances = results.filter(result => result.status === 'absent');
    
    if (absentAttendances.length > 0) {
      // Get student-parent relationships for absent students
      const absentStudentIds = absentAttendances.map(a => a.student_id);
      const studentParents = await db.select({
        student_id: studentsTable.id,
        parent_id: studentsTable.parent_id
      })
        .from(studentsTable)
        .execute();

      // Create notifications for parents (filter out students without parents)
      const notifications = studentParents
        .filter(sp => sp.parent_id && absentStudentIds.includes(sp.student_id))
        .map(sp => {
          const attendanceRecord = absentAttendances.find(a => a.student_id === sp.student_id);
          return {
            parent_id: sp.parent_id!,
            student_id: sp.student_id,
            message: `Your child was marked absent on ${attendanceRecord!.date}`,
            type: 'attendance',
            status: 'pending' as const
          };
        });

      if (notifications.length > 0) {
        await db.insert(notificationsTable)
          .values(notifications)
          .execute();
      }
    }

    // Return attendance records with proper date conversion
    return results.map(record => ({
      ...record,
      date: new Date(record.date)
    }));
  } catch (error) {
    console.error('Bulk attendance creation failed:', error);
    throw error;
  }
};