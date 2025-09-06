import { db } from '../db';
import { attendancesTable, studentsTable, usersTable, subjectsTable, classesTable } from '../db/schema';
import { type AttendanceReportInput } from '../schema';
import { eq, gte, lte, and, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export type ExportFormat = 'excel' | 'pdf';

export type ExportAttendanceInput = AttendanceReportInput & {
  format: ExportFormat;
};

interface AttendanceReportData {
  id: number;
  student_name: string;
  student_number: string;
  class_name: string;
  subject_name: string | null;
  date: string; // Date comes as string from database
  status: string;
  notes: string | null;
}

export const exportAttendance = async (input: ExportAttendanceInput): Promise<Buffer> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Date range filters (required) - convert dates to strings for date columns
    conditions.push(gte(attendancesTable.date, input.start_date.toISOString().split('T')[0]));
    conditions.push(lte(attendancesTable.date, input.end_date.toISOString().split('T')[0]));

    // Optional filters
    if (input.class_id !== undefined) {
      conditions.push(eq(studentsTable.class_id, input.class_id));
    }

    if (input.student_id !== undefined) {
      conditions.push(eq(attendancesTable.student_id, input.student_id));
    }

    if (input.subject_id !== undefined) {
      conditions.push(eq(attendancesTable.subject_id, input.subject_id));
    }

    // Build the query with joins to get all necessary data
    const query = db.select({
      id: attendancesTable.id,
      student_name: usersTable.name,
      student_number: studentsTable.student_number,
      class_name: classesTable.name,
      subject_name: subjectsTable.name,
      date: attendancesTable.date,
      status: attendancesTable.status,
      notes: attendancesTable.notes
    })
    .from(attendancesTable)
    .innerJoin(studentsTable, eq(attendancesTable.student_id, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.user_id, usersTable.id))
    .innerJoin(classesTable, eq(studentsTable.class_id, classesTable.id))
    .leftJoin(subjectsTable, eq(attendancesTable.subject_id, subjectsTable.id))
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));

    // Execute query
    const results = await query.execute();

    const attendanceData: AttendanceReportData[] = results.map(result => ({
      id: result.id,
      student_name: result.student_name,
      student_number: result.student_number,
      class_name: result.class_name,
      subject_name: result.subject_name,
      date: result.date,
      status: result.status,
      notes: result.notes
    }));

    // Generate export based on format
    if (input.format === 'excel') {
      return generateExcelExport(attendanceData, input);
    } else {
      return generatePDFExport(attendanceData, input);
    }
  } catch (error) {
    console.error('Attendance export failed:', error);
    throw error;
  }
};

const generateExcelExport = (data: AttendanceReportData[], input: ExportAttendanceInput): Buffer => {
  // Simple CSV format for Excel compatibility
  const headers = ['ID', 'Student Name', 'Student Number', 'Class', 'Subject', 'Date', 'Status', 'Notes'];
  
  let csvContent = headers.join(',') + '\n';
  
  data.forEach(row => {
    const csvRow = [
      row.id.toString(),
      `"${row.student_name}"`,
      `"${row.student_number}"`,
      `"${row.class_name}"`,
      row.subject_name ? `"${row.subject_name}"` : '""',
      row.date, // Already in YYYY-MM-DD format from database
      `"${row.status}"`,
      row.notes ? `"${row.notes.replace(/"/g, '""')}"` : '""' // Escape quotes
    ];
    csvContent += csvRow.join(',') + '\n';
  });

  return Buffer.from(csvContent, 'utf-8');
};

const generatePDFExport = (data: AttendanceReportData[], input: ExportAttendanceInput): Buffer => {
  // Simple text-based PDF content
  const title = 'Attendance Report';
  const dateRange = `Period: ${input.start_date.toDateString()} - ${input.end_date.toDateString()}`;
  
  let content = `${title}\n${dateRange}\n\n`;
  content += 'Generated Report Summary:\n';
  content += `Total Records: ${data.length}\n\n`;
  
  // Group by status for summary
  const statusSummary = data.reduce((acc, record) => {
    acc[record.status] = (acc[record.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  content += 'Status Summary:\n';
  Object.entries(statusSummary).forEach(([status, count]) => {
    content += `${status}: ${count}\n`;
  });
  
  content += '\nDetailed Records:\n';
  content += '-'.repeat(80) + '\n';
  
  data.forEach(record => {
    content += `Date: ${record.date}\n`;
    content += `Student: ${record.student_name} (${record.student_number})\n`;
    content += `Class: ${record.class_name}\n`;
    content += `Subject: ${record.subject_name || 'General'}\n`;
    content += `Status: ${record.status}\n`;
    if (record.notes) {
      content += `Notes: ${record.notes}\n`;
    }
    content += '-'.repeat(40) + '\n';
  });

  return Buffer.from(content, 'utf-8');
};