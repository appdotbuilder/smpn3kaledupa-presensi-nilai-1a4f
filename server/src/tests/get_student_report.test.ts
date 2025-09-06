import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  studentsTable, 
  classesTable, 
  attendancesTable,
  gradesTable,
  subjectsTable,
  gradeConfigsTable
} from '../db/schema';
import { type StudentReportInput } from '../schema';
import { getStudentReport } from '../handlers/get_student_report';

// Test data setup
const academicYear = '2024/2025';

const testInput: StudentReportInput = {
  student_id: 1,
  academic_year: academicYear
};

describe('getStudentReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should generate comprehensive student report', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([
      { id: 1, email: 'student@test.com', password: 'password', name: 'Test Student', role: 'student' },
      { id: 2, email: 'teacher@test.com', password: 'password', name: 'Test Teacher', role: 'teacher' }
    ]);

    await db.insert(classesTable).values({
      id: 1,
      name: 'VII-A',
      grade_level: 7,
      academic_year: academicYear
    });

    await db.insert(studentsTable).values({
      id: 1,
      user_id: 1,
      student_number: 'S001',
      class_id: 1,
      parent_id: null
    });

    await db.insert(subjectsTable).values([
      { id: 1, name: 'Mathematics', code: 'MATH' },
      { id: 2, name: 'English', code: 'ENG' }
    ]);

    // Insert attendance data
    await db.insert(attendancesTable).values([
      { student_id: 1, subject_id: null, date: '2024-01-15', status: 'present', notes: null, recorded_by: 2 },
      { student_id: 1, subject_id: null, date: '2024-01-16', status: 'absent', notes: null, recorded_by: 2 },
      { student_id: 1, subject_id: null, date: '2024-01-17', status: 'late', notes: null, recorded_by: 2 },
      { student_id: 1, subject_id: null, date: '2024-01-18', status: 'present', notes: null, recorded_by: 2 },
      { student_id: 1, subject_id: null, date: '2024-01-19', status: 'excused', notes: null, recorded_by: 2 }
    ]);

    // Insert grade data
    await db.insert(gradesTable).values([
      // Math grades
      { student_id: 1, subject_id: 1, assignment_type: 'daily', assignment_name: 'Quiz 1', score: '85', max_score: '100', weight: '10', date_recorded: '2024-01-20', recorded_by: 2 },
      { student_id: 1, subject_id: 1, assignment_type: 'daily', assignment_name: 'Quiz 2', score: '90', max_score: '100', weight: '10', date_recorded: '2024-01-25', recorded_by: 2 },
      { student_id: 1, subject_id: 1, assignment_type: 'midterm', assignment_name: 'Midterm Exam', score: '88', max_score: '100', weight: '30', date_recorded: '2024-02-15', recorded_by: 2 },
      { student_id: 1, subject_id: 1, assignment_type: 'final', assignment_name: 'Final Exam', score: '92', max_score: '100', weight: '30', date_recorded: '2024-06-15', recorded_by: 2 },
      
      // English grades
      { student_id: 1, subject_id: 2, assignment_type: 'daily', assignment_name: 'Essay 1', score: '80', max_score: '100', weight: '10', date_recorded: '2024-01-22', recorded_by: 2 },
      { student_id: 1, subject_id: 2, assignment_type: 'midterm', assignment_name: 'Midterm Exam', score: '85', max_score: '100', weight: '30', date_recorded: '2024-02-16', recorded_by: 2 },
      { student_id: 1, subject_id: 2, assignment_type: 'final', assignment_name: 'Final Exam', score: '87', max_score: '100', weight: '30', date_recorded: '2024-06-16', recorded_by: 2 }
    ]);

    // Insert grade configurations
    await db.insert(gradeConfigsTable).values([
      { subject_id: 1, class_id: 1, daily_weight: '40', midterm_weight: '30', final_weight: '30', academic_year: academicYear },
      { subject_id: 2, class_id: 1, daily_weight: '35', midterm_weight: '35', final_weight: '30', academic_year: academicYear }
    ]);

    const result = await getStudentReport(testInput);

    // Verify student information
    expect(result.student.id).toBe(1);
    expect(result.student.name).toBe('Test Student');
    expect(result.student.student_number).toBe('S001');
    expect(result.student.class_name).toBe('VII-A');

    // Verify attendance statistics
    expect(result.attendance.total_days).toBe(5);
    expect(result.attendance.present).toBe(2);
    expect(result.attendance.absent).toBe(1);
    expect(result.attendance.late).toBe(1);
    expect(result.attendance.excused).toBe(1);
    expect(result.attendance.attendance_percentage).toBe(40); // 2/5 * 100

    // Verify grades structure
    expect(result.grades).toHaveLength(2);
    
    // Find Math and English grades
    const mathGrade = result.grades.find(g => g.subject_code === 'MATH');
    const englishGrade = result.grades.find(g => g.subject_code === 'ENG');
    
    expect(mathGrade).toBeDefined();
    expect(englishGrade).toBeDefined();

    // Verify Math grade calculations
    expect(mathGrade!.subject_name).toBe('Mathematics');
    expect(mathGrade!.daily_average).toBe(87.5); // (85 + 90) / 2
    expect(mathGrade!.midterm_average).toBe(88);
    expect(mathGrade!.final_average).toBe(92);
    // Weighted: 87.5 * 0.4 + 88 * 0.3 + 92 * 0.3 = 35 + 26.4 + 27.6 = 89
    expect(mathGrade!.weighted_final_grade).toBe(89);

    // Verify English grade calculations
    expect(englishGrade!.subject_name).toBe('English');
    expect(englishGrade!.daily_average).toBe(80);
    expect(englishGrade!.midterm_average).toBe(85);
    expect(englishGrade!.final_average).toBe(87);
    // Weighted: 80 * 0.35 + 85 * 0.35 + 87 * 0.3 = 28 + 29.75 + 26.1 = 83.85
    expect(englishGrade!.weighted_final_grade).toBe(83.85);

    // Verify overall grade average
    expect(result.overall_grade_average).toBe(86.43); // (89 + 83.85) / 2 = 86.425, rounded to 86.43
  });

  it('should handle student with no attendance data', async () => {
    // Create prerequisite data without attendance
    await db.insert(usersTable).values({
      id: 1, email: 'student@test.com', password: 'password', name: 'Test Student', role: 'student'
    });

    await db.insert(classesTable).values({
      id: 1,
      name: 'VII-A',
      grade_level: 7,
      academic_year: academicYear
    });

    await db.insert(studentsTable).values({
      id: 1,
      user_id: 1,
      student_number: 'S001',
      class_id: 1,
      parent_id: null
    });

    const result = await getStudentReport(testInput);

    expect(result.attendance.total_days).toBe(0);
    expect(result.attendance.present).toBe(0);
    expect(result.attendance.attendance_percentage).toBe(0);
  });

  it('should handle student with no grade data', async () => {
    // Create prerequisite data without grades
    await db.insert(usersTable).values({
      id: 1, email: 'student@test.com', password: 'password', name: 'Test Student', role: 'student'
    });

    await db.insert(classesTable).values({
      id: 1,
      name: 'VII-A',
      grade_level: 7,
      academic_year: academicYear
    });

    await db.insert(studentsTable).values({
      id: 1,
      user_id: 1,
      student_number: 'S001',
      class_id: 1,
      parent_id: null
    });

    const result = await getStudentReport(testInput);

    expect(result.grades).toHaveLength(0);
    expect(result.overall_grade_average).toBe(0);
  });

  it('should use default weights when no grade configuration exists', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([
      { id: 1, email: 'student@test.com', password: 'password', name: 'Test Student', role: 'student' },
      { id: 2, email: 'teacher@test.com', password: 'password', name: 'Test Teacher', role: 'teacher' }
    ]);

    await db.insert(classesTable).values({
      id: 1,
      name: 'VII-A',
      grade_level: 7,
      academic_year: academicYear
    });

    await db.insert(studentsTable).values({
      id: 1,
      user_id: 1,
      student_number: 'S001',
      class_id: 1,
      parent_id: null
    });

    await db.insert(subjectsTable).values({
      id: 1, name: 'Mathematics', code: 'MATH'
    });

    // Insert grades without grade configuration
    await db.insert(gradesTable).values([
      { student_id: 1, subject_id: 1, assignment_type: 'daily', assignment_name: 'Quiz 1', score: '80', max_score: '100', weight: '10', date_recorded: '2024-01-20', recorded_by: 2 },
      { student_id: 1, subject_id: 1, assignment_type: 'midterm', assignment_name: 'Midterm', score: '85', max_score: '100', weight: '30', date_recorded: '2024-02-15', recorded_by: 2 },
      { student_id: 1, subject_id: 1, assignment_type: 'final', assignment_name: 'Final', score: '90', max_score: '100', weight: '30', date_recorded: '2024-06-15', recorded_by: 2 }
    ]);

    const result = await getStudentReport(testInput);

    const mathGrade = result.grades[0];
    // Default weights: 40% daily, 30% midterm, 30% final
    // 80 * 0.4 + 85 * 0.3 + 90 * 0.3 = 32 + 25.5 + 27 = 84.5
    expect(mathGrade.weighted_final_grade).toBe(84.5);
  });

  it('should handle partial grade data correctly', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([
      { id: 1, email: 'student@test.com', password: 'password', name: 'Test Student', role: 'student' },
      { id: 2, email: 'teacher@test.com', password: 'password', name: 'Test Teacher', role: 'teacher' }
    ]);

    await db.insert(classesTable).values({
      id: 1,
      name: 'VII-A',
      grade_level: 7,
      academic_year: academicYear
    });

    await db.insert(studentsTable).values({
      id: 1,
      user_id: 1,
      student_number: 'S001',
      class_id: 1,
      parent_id: null
    });

    await db.insert(subjectsTable).values({
      id: 1, name: 'Mathematics', code: 'MATH'
    });

    // Insert only daily grades (no midterm or final)
    await db.insert(gradesTable).values([
      { student_id: 1, subject_id: 1, assignment_type: 'daily', assignment_name: 'Quiz 1', score: '85', max_score: '100', weight: '10', date_recorded: '2024-01-20', recorded_by: 2 },
      { student_id: 1, subject_id: 1, assignment_type: 'daily', assignment_name: 'Quiz 2', score: '90', max_score: '100', weight: '10', date_recorded: '2024-01-25', recorded_by: 2 }
    ]);

    const result = await getStudentReport(testInput);

    const mathGrade = result.grades[0];
    expect(mathGrade.daily_average).toBe(87.5); // (85 + 90) / 2
    expect(mathGrade.midterm_average).toBe(0); // No midterm grades
    expect(mathGrade.final_average).toBe(0); // No final grades
    // Weighted: 87.5 * 0.4 + 0 * 0.3 + 0 * 0.3 = 35
    expect(mathGrade.weighted_final_grade).toBe(35);
  });

  it('should throw error for non-existent student', async () => {
    const invalidInput: StudentReportInput = {
      student_id: 999,
      academic_year: academicYear
    };

    await expect(getStudentReport(invalidInput)).rejects.toThrow(/Student with ID 999 not found/);
  });

  it('should handle different academic years correctly', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values([
      { id: 1, email: 'student@test.com', password: 'password', name: 'Test Student', role: 'student' },
      { id: 2, email: 'teacher@test.com', password: 'password', name: 'Test Teacher', role: 'teacher' }
    ]);

    await db.insert(classesTable).values({
      id: 1,
      name: 'VII-A',
      grade_level: 7,
      academic_year: academicYear
    });

    await db.insert(studentsTable).values({
      id: 1,
      user_id: 1,
      student_number: 'S001',
      class_id: 1,
      parent_id: null
    });

    await db.insert(subjectsTable).values({
      id: 1, name: 'Mathematics', code: 'MATH'
    });

    // Insert data for different years
    await db.insert(attendancesTable).values([
      { student_id: 1, subject_id: null, date: '2024-01-15', status: 'present', notes: null, recorded_by: 2 },
      { student_id: 1, subject_id: null, date: '2023-01-15', status: 'absent', notes: null, recorded_by: 2 } // Previous year
    ]);

    await db.insert(gradesTable).values([
      { student_id: 1, subject_id: 1, assignment_type: 'daily', assignment_name: 'Quiz 2024', score: '90', max_score: '100', weight: '10', date_recorded: '2024-01-20', recorded_by: 2 },
      { student_id: 1, subject_id: 1, assignment_type: 'daily', assignment_name: 'Quiz 2023', score: '70', max_score: '100', weight: '10', date_recorded: '2023-01-20', recorded_by: 2 } // Previous year
    ]);

    const result = await getStudentReport(testInput);

    // Should only include 2024 data
    expect(result.attendance.total_days).toBe(1);
    expect(result.attendance.present).toBe(1);
    
    const mathGrade = result.grades[0];
    expect(mathGrade.daily_average).toBe(90); // Only 2024 grade
  });
});