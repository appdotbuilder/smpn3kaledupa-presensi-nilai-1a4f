import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  classesTable, 
  subjectsTable, 
  studentsTable, 
  teachersTable,
  gradesTable 
} from '../db/schema';
import { type ExportGradesInput } from '../handlers/export_grades';
import { exportGrades } from '../handlers/export_grades';

// Test data setup
const testUser = {
  email: 'student@test.com',
  password: 'password123',
  name: 'Test Student',
  role: 'student' as const
};

const testTeacherUser = {
  email: 'teacher@test.com',
  password: 'password123',
  name: 'Test Teacher',
  role: 'teacher' as const
};

const testClass = {
  name: 'Class 7A',
  grade_level: 7,
  academic_year: '2024/2025'
};

const testSubject = {
  name: 'Mathematics',
  code: 'MATH7'
};

const testStudent = {
  student_number: 'STD001',
  parent_id: null
};

const testTeacher = {
  employee_number: 'EMP001'
};

const testGrade = {
  assignment_type: 'daily',
  assignment_name: 'Quiz 1',
  score: 85,
  max_score: 100,
  weight: 20,
  date_recorded: '2024-01-15'
};

describe('exportGrades', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should export grades in Excel format', async () => {
    // Create test data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacherUser] = await db.insert(usersTable).values(testTeacherUser).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [teacher] = await db.insert(teachersTable).values({
      ...testTeacher,
      user_id: teacherUser.id
    }).returning().execute();
    const [student] = await db.insert(studentsTable).values({
      ...testStudent,
      user_id: user.id,
      class_id: testClassRecord.id
    }).returning().execute();

    await db.insert(gradesTable).values({
      ...testGrade,
      student_id: student.id,
      subject_id: subject.id,
      recorded_by: teacherUser.id,
      score: testGrade.score.toString(),
      max_score: testGrade.max_score.toString(),
      weight: testGrade.weight.toString(),
      date_recorded: testGrade.date_recorded
    }).execute();

    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      format: 'excel'
    };

    const result = await exportGrades(input);

    // Verify it's a Buffer
    expect(result).toBeInstanceOf(Buffer);

    // Convert buffer to string to check CSV content
    const csvContent = result.toString('utf-8');
    
    // Check CSV headers
    expect(csvContent).toContain('Student Name,Student Number,Class,Subject');
    expect(csvContent).toContain('Assignment Type,Assignment Name,Score,Max Score');
    expect(csvContent).toContain('Percentage,Weight (%),Date Recorded,Recorded By');

    // Check data content
    expect(csvContent).toContain('"Test Student"');
    expect(csvContent).toContain('"STD001"');
    expect(csvContent).toContain('"Class 7A"');
    expect(csvContent).toContain('"Mathematics"');
    expect(csvContent).toContain('"daily"');
    expect(csvContent).toContain('"Quiz 1"');
    expect(csvContent).toContain('85');
    expect(csvContent).toContain('100');
    expect(csvContent).toContain('85%'); // percentage
    expect(csvContent).toContain('20%'); // weight
    expect(csvContent).toContain('2024-01-15');
    expect(csvContent).toContain('"Test Teacher"');
  });

  it('should export grades in PDF format', async () => {
    // Create test data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacherUser] = await db.insert(usersTable).values(testTeacherUser).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [teacher] = await db.insert(teachersTable).values({
      ...testTeacher,
      user_id: teacherUser.id
    }).returning().execute();
    const [student] = await db.insert(studentsTable).values({
      ...testStudent,
      user_id: user.id,
      class_id: testClassRecord.id
    }).returning().execute();

    await db.insert(gradesTable).values({
      ...testGrade,
      student_id: student.id,
      subject_id: subject.id,
      recorded_by: teacherUser.id,
      score: testGrade.score.toString(),
      max_score: testGrade.max_score.toString(),
      weight: testGrade.weight.toString(),
      date_recorded: testGrade.date_recorded
    }).execute();

    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      format: 'pdf'
    };

    const result = await exportGrades(input);

    // Verify it's a Buffer
    expect(result).toBeInstanceOf(Buffer);

    // Convert buffer to string to check PDF-like content
    const pdfContent = result.toString('utf-8');
    
    // Check PDF headers and structure
    expect(pdfContent).toContain('GRADE EXPORT REPORT');
    expect(pdfContent).toContain('Academic Year: 2024/2025');
    expect(pdfContent).toContain('Generated:');

    // Check student information
    expect(pdfContent).toContain('Student: Test Student (STD001)');
    expect(pdfContent).toContain('Class: Class 7A');

    // Check grade details
    expect(pdfContent).toContain('Subject: Mathematics');
    expect(pdfContent).toContain('Assignment: Quiz 1 (daily)');
    expect(pdfContent).toContain('Score: 85/100 (85%)');
    expect(pdfContent).toContain('Weight: 20%');
    expect(pdfContent).toContain('Date: 2024-01-15');
    expect(pdfContent).toContain('Recorded by: Test Teacher');
  });

  it('should filter by class_id', async () => {
    // Create test data with two classes
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacherUser] = await db.insert(usersTable).values(testTeacherUser).returning().execute();
    const [class1] = await db.insert(classesTable).values(testClass).returning().execute();
    const [class2] = await db.insert(classesTable).values({
      name: 'Class 7B',
      grade_level: 7,
      academic_year: '2024/2025'
    }).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    
    const [student1] = await db.insert(studentsTable).values({
      ...testStudent,
      user_id: user.id,
      class_id: class1.id
    }).returning().execute();
    
    // Create second student for different class
    const [user2] = await db.insert(usersTable).values({
      email: 'student2@test.com',
      password: 'password123',
      name: 'Test Student 2',
      role: 'student' as const
    }).returning().execute();
    
    const [student2] = await db.insert(studentsTable).values({
      student_number: 'STD002',
      user_id: user2.id,
      class_id: class2.id,
      parent_id: null
    }).returning().execute();

    // Create grades for both students
    await db.insert(gradesTable).values([
      {
        ...testGrade,
        student_id: student1.id,
        subject_id: subject.id,
        recorded_by: teacherUser.id,
        score: testGrade.score.toString(),
        max_score: testGrade.max_score.toString(),
        weight: testGrade.weight.toString(),
        date_recorded: testGrade.date_recorded
      },
      {
        ...testGrade,
        student_id: student2.id,
        subject_id: subject.id,
        recorded_by: teacherUser.id,
        score: '75',
        max_score: testGrade.max_score.toString(),
        weight: testGrade.weight.toString(),
        assignment_name: 'Quiz 2',
        date_recorded: testGrade.date_recorded
      }
    ]).execute();

    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      class_id: class1.id,
      format: 'excel'
    };

    const result = await exportGrades(input);
    const csvContent = result.toString('utf-8');

    // Should contain student from class1 but not class2
    expect(csvContent).toContain('"Test Student"');
    expect(csvContent).toContain('"Class 7A"');
    expect(csvContent).toContain('"Quiz 1"');
    
    // Should NOT contain student from class2
    expect(csvContent).not.toContain('"Test Student 2"');
    expect(csvContent).not.toContain('"Class 7B"');
    expect(csvContent).not.toContain('"Quiz 2"');
  });

  it('should filter by student_id', async () => {
    // Create test data with two students
    const [user1] = await db.insert(usersTable).values(testUser).returning().execute();
    const [user2] = await db.insert(usersTable).values({
      email: 'student2@test.com',
      password: 'password123',
      name: 'Test Student 2',
      role: 'student' as const
    }).returning().execute();
    const [teacherUser] = await db.insert(usersTable).values(testTeacherUser).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    
    const [student1] = await db.insert(studentsTable).values({
      ...testStudent,
      user_id: user1.id,
      class_id: testClassRecord.id
    }).returning().execute();
    
    const [student2] = await db.insert(studentsTable).values({
      student_number: 'STD002',
      user_id: user2.id,
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();

    // Create grades for both students
    await db.insert(gradesTable).values([
      {
        ...testGrade,
        student_id: student1.id,
        subject_id: subject.id,
        recorded_by: teacherUser.id,
        score: testGrade.score.toString(),
        max_score: testGrade.max_score.toString(),
        weight: testGrade.weight.toString(),
        date_recorded: testGrade.date_recorded
      },
      {
        ...testGrade,
        student_id: student2.id,
        subject_id: subject.id,
        recorded_by: teacherUser.id,
        score: '75',
        max_score: testGrade.max_score.toString(),
        weight: testGrade.weight.toString(),
        assignment_name: 'Quiz 2',
        date_recorded: testGrade.date_recorded
      }
    ]).execute();

    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      student_id: student1.id,
      format: 'excel'
    };

    const result = await exportGrades(input);
    const csvContent = result.toString('utf-8');

    // Should contain only student1's data
    expect(csvContent).toContain('"Test Student"');
    expect(csvContent).toContain('"STD001"');
    expect(csvContent).toContain('"Quiz 1"');
    
    // Should NOT contain student2's data
    expect(csvContent).not.toContain('"Test Student 2"');
    expect(csvContent).not.toContain('"STD002"');
    expect(csvContent).not.toContain('"Quiz 2"');
  });

  it('should filter by subject_id', async () => {
    // Create test data with two subjects
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacherUser] = await db.insert(usersTable).values(testTeacherUser).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject1] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [subject2] = await db.insert(subjectsTable).values({
      name: 'English',
      code: 'ENG7'
    }).returning().execute();
    
    const [student] = await db.insert(studentsTable).values({
      ...testStudent,
      user_id: user.id,
      class_id: testClassRecord.id
    }).returning().execute();

    // Create grades for both subjects
    await db.insert(gradesTable).values([
      {
        ...testGrade,
        student_id: student.id,
        subject_id: subject1.id,
        recorded_by: teacherUser.id,
        score: testGrade.score.toString(),
        max_score: testGrade.max_score.toString(),
        weight: testGrade.weight.toString(),
        date_recorded: testGrade.date_recorded
      },
      {
        ...testGrade,
        student_id: student.id,
        subject_id: subject2.id,
        recorded_by: teacherUser.id,
        score: '90',
        max_score: testGrade.max_score.toString(),
        weight: testGrade.weight.toString(),
        assignment_name: 'Essay 1',
        date_recorded: testGrade.date_recorded
      }
    ]).execute();

    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      subject_id: subject1.id,
      format: 'excel'
    };

    const result = await exportGrades(input);
    const csvContent = result.toString('utf-8');

    // Should contain only Mathematics grades
    expect(csvContent).toContain('"Mathematics"');
    expect(csvContent).toContain('"Quiz 1"');
    expect(csvContent).toContain('85');
    
    // Should NOT contain English grades
    expect(csvContent).not.toContain('"English"');
    expect(csvContent).not.toContain('"Essay 1"');
    expect(csvContent).not.toContain('90');
  });

  it('should handle multiple grades for same student', async () => {
    // Create test data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacherUser] = await db.insert(usersTable).values(testTeacherUser).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [student] = await db.insert(studentsTable).values({
      ...testStudent,
      user_id: user.id,
      class_id: testClassRecord.id
    }).returning().execute();

    // Create multiple grades
    await db.insert(gradesTable).values([
      {
        ...testGrade,
        student_id: student.id,
        subject_id: subject.id,
        recorded_by: teacherUser.id,
        assignment_name: 'Quiz 1',
        score: '85',
        max_score: '100',
        weight: '20',
        date_recorded: testGrade.date_recorded
      },
      {
        ...testGrade,
        student_id: student.id,
        subject_id: subject.id,
        recorded_by: teacherUser.id,
        assignment_type: 'midterm',
        assignment_name: 'Midterm Exam',
        score: '78',
        max_score: '100',
        weight: '30',
        date_recorded: testGrade.date_recorded
      },
      {
        ...testGrade,
        student_id: student.id,
        subject_id: subject.id,
        recorded_by: teacherUser.id,
        assignment_type: 'final',
        assignment_name: 'Final Exam',
        score: '92',
        max_score: '100',
        weight: '50',
        date_recorded: testGrade.date_recorded
      }
    ]).execute();

    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      format: 'pdf'
    };

    const result = await exportGrades(input);
    const pdfContent = result.toString('utf-8');

    // Should contain all three assignments
    expect(pdfContent).toContain('Quiz 1 (daily)');
    expect(pdfContent).toContain('Score: 85/100 (85%)');
    expect(pdfContent).toContain('Weight: 20%');
    
    expect(pdfContent).toContain('Midterm Exam (midterm)');
    expect(pdfContent).toContain('Score: 78/100 (78%)');
    expect(pdfContent).toContain('Weight: 30%');
    
    expect(pdfContent).toContain('Final Exam (final)');
    expect(pdfContent).toContain('Score: 92/100 (92%)');
    expect(pdfContent).toContain('Weight: 50%');

    // Student should appear only once in the header
    const studentHeaderMatches = pdfContent.match(/Student: Test Student \(STD001\)/g);
    expect(studentHeaderMatches).toHaveLength(1);
  });

  it('should calculate percentage correctly', async () => {
    // Create test data with fractional scores
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacherUser] = await db.insert(usersTable).values(testTeacherUser).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [student] = await db.insert(studentsTable).values({
      ...testStudent,
      user_id: user.id,
      class_id: testClassRecord.id
    }).returning().execute();

    await db.insert(gradesTable).values({
      ...testGrade,
      student_id: student.id,
      subject_id: subject.id,
      recorded_by: teacherUser.id,
      score: '87.5', // Will result in 87.5%
      max_score: '100',
      weight: testGrade.weight.toString(),
      date_recorded: testGrade.date_recorded
    }).execute();

    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      format: 'excel'
    };

    const result = await exportGrades(input);
    const csvContent = result.toString('utf-8');

    // Should show correct percentage calculation
    expect(csvContent).toContain('87.5');
    expect(csvContent).toContain('87.5%');
  });

  it('should return empty export for no matching grades', async () => {
    const input: ExportGradesInput = {
      academic_year: '2024/2025',
      format: 'excel'
    };

    const result = await exportGrades(input);
    const csvContent = result.toString('utf-8');

    // Should contain only headers
    expect(csvContent).toContain('Student Name,Student Number,Class,Subject');
    
    // Should not contain any data rows (only one line = headers)
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    expect(lines).toHaveLength(1);
  });
});