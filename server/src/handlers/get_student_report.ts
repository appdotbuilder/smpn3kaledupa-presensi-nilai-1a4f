import { db } from '../db';
import { 
  studentsTable, 
  usersTable, 
  classesTable, 
  attendancesTable, 
  gradesTable,
  subjectsTable,
  gradeConfigsTable
} from '../db/schema';
import { type StudentReportInput } from '../schema';
import { eq, and, count, avg, sql } from 'drizzle-orm';

// Define a comprehensive student report type
export type StudentReport = {
  student: {
    id: number;
    name: string;
    student_number: string;
    class_name: string;
  };
  attendance: {
    total_days: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendance_percentage: number;
  };
  grades: Array<{
    subject_name: string;
    subject_code: string;
    daily_average: number;
    midterm_average: number;
    final_average: number;
    weighted_final_grade: number;
  }>;
  overall_grade_average: number;
};

export const getStudentReport = async (input: StudentReportInput): Promise<StudentReport> => {
  try {
    // Get student basic information
    const studentQuery = await db.select({
      student_id: studentsTable.id,
      student_number: studentsTable.student_number,
      name: usersTable.name,
      class_name: classesTable.name,
      class_id: studentsTable.class_id
    })
    .from(studentsTable)
    .innerJoin(usersTable, eq(studentsTable.user_id, usersTable.id))
    .innerJoin(classesTable, eq(studentsTable.class_id, classesTable.id))
    .where(eq(studentsTable.id, input.student_id))
    .execute();

    if (studentQuery.length === 0) {
      throw new Error(`Student with ID ${input.student_id} not found`);
    }

    const studentInfo = studentQuery[0];

    // Get attendance statistics
    const attendanceStats = await db.select({
      total_days: count(attendancesTable.id).as('total_days'),
      present: sql<string>`count(case when ${attendancesTable.status} = 'present' then 1 end)`,
      absent: sql<string>`count(case when ${attendancesTable.status} = 'absent' then 1 end)`,
      late: sql<string>`count(case when ${attendancesTable.status} = 'late' then 1 end)`,
      excused: sql<string>`count(case when ${attendancesTable.status} = 'excused' then 1 end)`
    })
    .from(attendancesTable)
    .where(and(
      eq(attendancesTable.student_id, input.student_id),
      sql`extract(year from ${attendancesTable.date}) = ${input.academic_year.split('/')[0]}`
    ))
    .execute();

    const attendanceRaw = attendanceStats[0];
    const attendance = {
      total_days: attendanceRaw ? parseInt(attendanceRaw.total_days.toString()) : 0,
      present: attendanceRaw ? parseInt(attendanceRaw.present) : 0,
      absent: attendanceRaw ? parseInt(attendanceRaw.absent) : 0,
      late: attendanceRaw ? parseInt(attendanceRaw.late) : 0,
      excused: attendanceRaw ? parseInt(attendanceRaw.excused) : 0
    };

    const attendance_percentage = attendance.total_days > 0 
      ? Math.round((attendance.present / attendance.total_days) * 100)
      : 0;

    // Get grade information by subject
    const gradeQuery = await db.select({
      subject_name: subjectsTable.name,
      subject_code: subjectsTable.code,
      subject_id: subjectsTable.id,
      assignment_type: gradesTable.assignment_type,
      score: gradesTable.score,
      max_score: gradesTable.max_score
    })
    .from(gradesTable)
    .innerJoin(subjectsTable, eq(gradesTable.subject_id, subjectsTable.id))
    .where(and(
      eq(gradesTable.student_id, input.student_id),
      sql`extract(year from ${gradesTable.date_recorded}) = ${input.academic_year.split('/')[0]}`
    ))
    .execute();

    // Get grade configurations for weighted calculations
    const gradeConfigs = await db.select({
      subject_id: gradeConfigsTable.subject_id,
      daily_weight: gradeConfigsTable.daily_weight,
      midterm_weight: gradeConfigsTable.midterm_weight,
      final_weight: gradeConfigsTable.final_weight
    })
    .from(gradeConfigsTable)
    .where(and(
      eq(gradeConfigsTable.class_id, studentInfo.class_id),
      eq(gradeConfigsTable.academic_year, input.academic_year)
    ))
    .execute();

    // Process grades by subject
    const subjectGrades = new Map<number, {
      subject_name: string;
      subject_code: string;
      daily_scores: Array<{ score: number; max_score: number }>;
      midterm_scores: Array<{ score: number; max_score: number }>;
      final_scores: Array<{ score: number; max_score: number }>;
    }>();

    // Group grades by subject and type
    for (const grade of gradeQuery) {
      const subjectId = grade.subject_id;
      
      if (!subjectGrades.has(subjectId)) {
        subjectGrades.set(subjectId, {
          subject_name: grade.subject_name,
          subject_code: grade.subject_code,
          daily_scores: [],
          midterm_scores: [],
          final_scores: []
        });
      }

      const subjectData = subjectGrades.get(subjectId)!;
      const scoreData = {
        score: parseFloat(grade.score),
        max_score: parseFloat(grade.max_score)
      };

      switch (grade.assignment_type) {
        case 'daily':
          subjectData.daily_scores.push(scoreData);
          break;
        case 'midterm':
          subjectData.midterm_scores.push(scoreData);
          break;
        case 'final':
          subjectData.final_scores.push(scoreData);
          break;
      }
    }

    // Calculate averages and final grades
    const grades = Array.from(subjectGrades.entries()).map(([subjectId, data]) => {
      const config = gradeConfigs.find(c => c.subject_id === subjectId);
      
      // Calculate averages for each assignment type
      const daily_average = calculateAverage(data.daily_scores);
      const midterm_average = calculateAverage(data.midterm_scores);
      const final_average = calculateAverage(data.final_scores);

      // Calculate weighted final grade using config weights or defaults
      let weighted_final_grade = 0;
      if (config) {
        const dailyWeight = parseFloat(config.daily_weight) / 100;
        const midtermWeight = parseFloat(config.midterm_weight) / 100;
        const finalWeight = parseFloat(config.final_weight) / 100;
        
        weighted_final_grade = 
          (daily_average * dailyWeight) +
          (midterm_average * midtermWeight) +
          (final_average * finalWeight);
      } else {
        // Default weights: 40% daily, 30% midterm, 30% final
        weighted_final_grade = 
          (daily_average * 0.4) +
          (midterm_average * 0.3) +
          (final_average * 0.3);
      }

      return {
        subject_name: data.subject_name,
        subject_code: data.subject_code,
        daily_average,
        midterm_average,
        final_average,
        weighted_final_grade: Math.round(weighted_final_grade * 100) / 100
      };
    });

    // Calculate overall grade average
    const overall_grade_average = grades.length > 0
      ? Math.round((grades.reduce((sum, grade) => sum + grade.weighted_final_grade, 0) / grades.length) * 100) / 100
      : 0;

    return {
      student: {
        id: studentInfo.student_id,
        name: studentInfo.name,
        student_number: studentInfo.student_number,
        class_name: studentInfo.class_name
      },
      attendance: {
        total_days: attendance.total_days,
        present: attendance.present,
        absent: attendance.absent,
        late: attendance.late,
        excused: attendance.excused,
        attendance_percentage
      },
      grades,
      overall_grade_average
    };
  } catch (error) {
    console.error('Student report generation failed:', error);
    throw error;
  }
};

// Helper function to calculate average percentage from scores
function calculateAverage(scores: Array<{ score: number; max_score: number }>): number {
  if (scores.length === 0) return 0;
  
  const totalPercentage = scores.reduce((sum, score) => {
    return sum + (score.score / score.max_score) * 100;
  }, 0);
  
  return Math.round((totalPercentage / scores.length) * 100) / 100;
}