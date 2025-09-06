import { db } from '../db';
import { 
  gradesTable, 
  studentsTable, 
  subjectsTable, 
  classesTable, 
  usersTable 
} from '../db/schema';
import { type GradeReportInput } from '../schema';
import { eq, and } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export type ExportFormat = 'excel' | 'pdf';

export type ExportGradesInput = GradeReportInput & {
  format: ExportFormat;
};

interface GradeExportData {
  student_name: string;
  student_number: string;
  class_name: string;
  subject_name: string;
  assignment_type: string;
  assignment_name: string;
  score: number;
  max_score: number;
  percentage: number;
  weight: number;
  date_recorded: string;
  recorded_by_name: string;
}

export const exportGrades = async (input: ExportGradesInput): Promise<Buffer> => {
  try {
    // Build the base query with joins to get all related data
    let baseQuery = db.select({
      student_name: usersTable.name,
      student_number: studentsTable.student_number,
      class_name: classesTable.name,
      subject_name: subjectsTable.name,
      assignment_type: gradesTable.assignment_type,
      assignment_name: gradesTable.assignment_name,
      score: gradesTable.score,
      max_score: gradesTable.max_score,
      weight: gradesTable.weight,
      date_recorded: gradesTable.date_recorded,
      recorded_by_id: gradesTable.recorded_by
    })
    .from(gradesTable)
    .innerJoin(studentsTable, eq(gradesTable.student_id, studentsTable.id))
    .innerJoin(usersTable, eq(studentsTable.user_id, usersTable.id))
    .innerJoin(classesTable, eq(studentsTable.class_id, classesTable.id))
    .innerJoin(subjectsTable, eq(gradesTable.subject_id, subjectsTable.id));

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (input.class_id !== undefined) {
      conditions.push(eq(studentsTable.class_id, input.class_id));
    }

    if (input.student_id !== undefined) {
      conditions.push(eq(gradesTable.student_id, input.student_id));
    }

    if (input.subject_id !== undefined) {
      conditions.push(eq(gradesTable.subject_id, input.subject_id));
    }

    // Apply where conditions if any exist
    const query = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    const results = await query.execute();

    // Process the data to calculate percentages and handle recorded_by names
    const gradeData: GradeExportData[] = await Promise.all(
      results.map(async (row) => {
        // Get the recorded_by user name
        const recordedByUser = await db.select({ name: usersTable.name })
          .from(usersTable)
          .where(eq(usersTable.id, row.recorded_by_id))
          .execute();

        return {
          student_name: row.student_name,
          student_number: row.student_number,
          class_name: row.class_name,
          subject_name: row.subject_name,
          assignment_type: row.assignment_type,
          assignment_name: row.assignment_name,
          score: parseFloat(row.score),
          max_score: parseFloat(row.max_score),
          percentage: Math.round((parseFloat(row.score) / parseFloat(row.max_score)) * 100 * 100) / 100,
          weight: parseFloat(row.weight),
          date_recorded: typeof row.date_recorded === 'string' 
            ? row.date_recorded 
            : (row.date_recorded as Date).toISOString().split('T')[0],
          recorded_by_name: recordedByUser[0]?.name || 'Unknown'
        };
      })
    );

    // Generate export based on format
    if (input.format === 'excel') {
      return generateExcelExport(gradeData, input);
    } else {
      return generatePdfExport(gradeData, input);
    }
  } catch (error) {
    console.error('Grade export failed:', error);
    throw error;
  }
};

const generateExcelExport = (data: GradeExportData[], input: ExportGradesInput): Buffer => {
  // Create CSV content (simplified Excel format)
  const headers = [
    'Student Name',
    'Student Number', 
    'Class',
    'Subject',
    'Assignment Type',
    'Assignment Name',
    'Score',
    'Max Score',
    'Percentage',
    'Weight (%)',
    'Date Recorded',
    'Recorded By'
  ];

  const csvRows = [
    headers.join(','),
    ...data.map(row => [
      `"${row.student_name}"`,
      `"${row.student_number}"`,
      `"${row.class_name}"`,
      `"${row.subject_name}"`,
      `"${row.assignment_type}"`,
      `"${row.assignment_name}"`,
      row.score.toString(),
      row.max_score.toString(),
      `${row.percentage}%`,
      `${row.weight}%`,
      row.date_recorded,
      `"${row.recorded_by_name}"`
    ].join(','))
  ];

  const csvContent = csvRows.join('\n');
  return Buffer.from(csvContent, 'utf-8');
};

const generatePdfExport = (data: GradeExportData[], input: ExportGradesInput): Buffer => {
  // Create simple PDF-like text content
  let content = `GRADE EXPORT REPORT\n`;
  content += `Academic Year: ${input.academic_year}\n`;
  content += `Generated: ${new Date().toISOString().split('T')[0]}\n`;
  content += `\n${'='.repeat(80)}\n\n`;

  // Group by student for better PDF formatting
  const groupedByStudent = data.reduce((acc, grade) => {
    const key = `${grade.student_name} (${grade.student_number})`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(grade);
    return acc;
  }, {} as Record<string, GradeExportData[]>);

  Object.entries(groupedByStudent).forEach(([studentInfo, grades]) => {
    content += `Student: ${studentInfo}\n`;
    content += `Class: ${grades[0].class_name}\n`;
    content += `\n`;
    
    grades.forEach(grade => {
      content += `  Subject: ${grade.subject_name}\n`;
      content += `  Assignment: ${grade.assignment_name} (${grade.assignment_type})\n`;
      content += `  Score: ${grade.score}/${grade.max_score} (${grade.percentage}%)\n`;
      content += `  Weight: ${grade.weight}%\n`;
      content += `  Date: ${grade.date_recorded}\n`;
      content += `  Recorded by: ${grade.recorded_by_name}\n`;
      content += `  ${'-'.repeat(40)}\n`;
    });
    
    content += `\n`;
  });

  return Buffer.from(content, 'utf-8');
};