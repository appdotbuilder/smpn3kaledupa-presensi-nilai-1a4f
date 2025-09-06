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
import { type GradeReportInput } from '../schema';
import { getGradeReport } from '../handlers/get_grade_report';

describe('getGradeReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create users
    const [adminUser] = await db.insert(usersTable)
      .values({
        email: 'admin@school.com',
        password: 'password123',
        name: 'Admin User',
        role: 'admin'
      })
      .returning();

    const [teacherUser] = await db.insert(usersTable)
      .values({
        email: 'teacher@school.com',
        password: 'password123',
        name: 'Math Teacher',
        role: 'teacher'
      })
      .returning();

    const [studentUser1] = await db.insert(usersTable)
      .values({
        email: 'student1@school.com',
        password: 'password123',
        name: 'Student One',
        role: 'student'
      })
      .returning();

    const [studentUser2] = await db.insert(usersTable)
      .values({
        email: 'student2@school.com',
        password: 'password123',
        name: 'Student Two',
        role: 'student'
      })
      .returning();

    // Create classes
    const [class1] = await db.insert(classesTable)
      .values({
        name: '7A',
        grade_level: 7,
        academic_year: '2024/2025'
      })
      .returning();

    const [class2] = await db.insert(classesTable)
      .values({
        name: '8A',
        grade_level: 8,
        academic_year: '2024/2025'
      })
      .returning();

    // Create subjects
    const [mathSubject] = await db.insert(subjectsTable)
      .values({
        name: 'Mathematics',
        code: 'MATH'
      })
      .returning();

    const [scienceSubject] = await db.insert(subjectsTable)
      .values({
        name: 'Science',
        code: 'SCI'
      })
      .returning();

    // Create teacher
    const [teacher] = await db.insert(teachersTable)
      .values({
        user_id: teacherUser.id,
        employee_number: 'T001'
      })
      .returning();

    // Create students
    const [student1] = await db.insert(studentsTable)
      .values({
        user_id: studentUser1.id,
        student_number: 'S001',
        class_id: class1.id,
        parent_id: null
      })
      .returning();

    const [student2] = await db.insert(studentsTable)
      .values({
        user_id: studentUser2.id,
        student_number: 'S002',
        class_id: class2.id,
        parent_id: null
      })
      .returning();

    return {
      adminUser,
      teacherUser,
      studentUser1,
      studentUser2,
      class1,
      class2,
      mathSubject,
      scienceSubject,
      teacher,
      student1,
      student2
    };
  };

  it('should return all grades when no filters are provided', async () => {
    const testData = await createTestData();

    // Create grades for both students
    await db.insert(gradesTable)
      .values([
        {
          student_id: testData.student1.id,
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Quiz 1',
          score: '85.50',
          max_score: '100.00',
          weight: '20.00',
          date_recorded: '2024-03-01',
          recorded_by: testData.teacher.user_id
        },
        {
          student_id: testData.student2.id,
          subject_id: testData.mathSubject.id,
          assignment_type: 'midterm',
          assignment_name: 'Midterm Exam',
          score: '92.00',
          max_score: '100.00',
          weight: '40.00',
          date_recorded: '2024-03-15',
          recorded_by: testData.teacher.user_id
        }
      ]);

    const input: GradeReportInput = {
      academic_year: '2024/2025'
    };

    const result = await getGradeReport(input);

    expect(result).toHaveLength(2);
    
    // Verify first grade
    const grade1 = result.find(g => g.assignment_name === 'Quiz 1');
    expect(grade1).toBeDefined();
    expect(grade1!.student_id).toEqual(testData.student1.id);
    expect(grade1!.subject_id).toEqual(testData.mathSubject.id);
    expect(grade1!.assignment_type).toEqual('daily');
    expect(grade1!.score).toEqual(85.5); // Numeric conversion
    expect(grade1!.max_score).toEqual(100);
    expect(grade1!.weight).toEqual(20);
    expect(typeof grade1!.score).toBe('number');
    expect(typeof grade1!.max_score).toBe('number');
    expect(typeof grade1!.weight).toBe('number');
    
    // Verify second grade
    const grade2 = result.find(g => g.assignment_name === 'Midterm Exam');
    expect(grade2).toBeDefined();
    expect(grade2!.student_id).toEqual(testData.student2.id);
    expect(grade2!.score).toEqual(92);
    expect(grade2!.assignment_type).toEqual('midterm');
  });

  it('should filter grades by student_id', async () => {
    const testData = await createTestData();

    // Create grades for both students
    await db.insert(gradesTable)
      .values([
        {
          student_id: testData.student1.id,
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Quiz 1',
          score: '85.50',
          max_score: '100.00',
          weight: '20.00',
          date_recorded: '2024-03-01',
          recorded_by: testData.teacher.user_id
        },
        {
          student_id: testData.student2.id,
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Quiz 2',
          score: '78.00',
          max_score: '100.00',
          weight: '20.00',
          date_recorded: '2024-03-02',
          recorded_by: testData.teacher.user_id
        }
      ]);

    const input: GradeReportInput = {
      student_id: testData.student1.id,
      academic_year: '2024/2025'
    };

    const result = await getGradeReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].student_id).toEqual(testData.student1.id);
    expect(result[0].assignment_name).toEqual('Quiz 1');
    expect(result[0].score).toEqual(85.5);
  });

  it('should filter grades by subject_id', async () => {
    const testData = await createTestData();

    // Create grades for different subjects
    await db.insert(gradesTable)
      .values([
        {
          student_id: testData.student1.id,
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Math Quiz',
          score: '85.00',
          max_score: '100.00',
          weight: '20.00',
          date_recorded: '2024-03-01',
          recorded_by: testData.teacher.user_id
        },
        {
          student_id: testData.student1.id,
          subject_id: testData.scienceSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Science Quiz',
          score: '90.00',
          max_score: '100.00',
          weight: '20.00',
          date_recorded: '2024-03-02',
          recorded_by: testData.teacher.user_id
        }
      ]);

    const input: GradeReportInput = {
      subject_id: testData.mathSubject.id,
      academic_year: '2024/2025'
    };

    const result = await getGradeReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].subject_id).toEqual(testData.mathSubject.id);
    expect(result[0].assignment_name).toEqual('Math Quiz');
  });

  it('should filter grades by class_id', async () => {
    const testData = await createTestData();

    // Create grades for students in different classes
    await db.insert(gradesTable)
      .values([
        {
          student_id: testData.student1.id, // In class1
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Class 1 Quiz',
          score: '85.00',
          max_score: '100.00',
          weight: '20.00',
          date_recorded: '2024-03-01',
          recorded_by: testData.teacher.user_id
        },
        {
          student_id: testData.student2.id, // In class2
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Class 2 Quiz',
          score: '92.00',
          max_score: '100.00',
          weight: '20.00',
          date_recorded: '2024-03-02',
          recorded_by: testData.teacher.user_id
        }
      ]);

    const input: GradeReportInput = {
      class_id: testData.class1.id,
      academic_year: '2024/2025'
    };

    const result = await getGradeReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].assignment_name).toEqual('Class 1 Quiz');
    expect(result[0].student_id).toEqual(testData.student1.id);
  });

  it('should filter with multiple conditions', async () => {
    const testData = await createTestData();

    // Create various grades
    await db.insert(gradesTable)
      .values([
        {
          student_id: testData.student1.id,
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Target Grade',
          score: '88.75',
          max_score: '100.00',
          weight: '25.00',
          date_recorded: '2024-03-01',
          recorded_by: testData.teacher.user_id
        },
        {
          student_id: testData.student1.id,
          subject_id: testData.scienceSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Other Subject',
          score: '95.00',
          max_score: '100.00',
          weight: '25.00',
          date_recorded: '2024-03-02',
          recorded_by: testData.teacher.user_id
        },
        {
          student_id: testData.student2.id,
          subject_id: testData.mathSubject.id,
          assignment_type: 'daily',
          assignment_name: 'Other Student',
          score: '82.00',
          max_score: '100.00',
          weight: '25.00',
          date_recorded: '2024-03-03',
          recorded_by: testData.teacher.user_id
        }
      ]);

    const input: GradeReportInput = {
      student_id: testData.student1.id,
      subject_id: testData.mathSubject.id,
      academic_year: '2024/2025'
    };

    const result = await getGradeReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].assignment_name).toEqual('Target Grade');
    expect(result[0].student_id).toEqual(testData.student1.id);
    expect(result[0].subject_id).toEqual(testData.mathSubject.id);
    expect(result[0].score).toEqual(88.75);
  });

  it('should return empty array when no grades match filters', async () => {
    const testData = await createTestData();

    const input: GradeReportInput = {
      student_id: 999, // Non-existent student
      academic_year: '2024/2025'
    };

    const result = await getGradeReport(input);

    expect(result).toHaveLength(0);
  });

  it('should handle grades with decimal scores correctly', async () => {
    const testData = await createTestData();

    await db.insert(gradesTable)
      .values({
        student_id: testData.student1.id,
        subject_id: testData.mathSubject.id,
        assignment_type: 'final',
        assignment_name: 'Final Exam',
        score: '87.25',
        max_score: '100.00',
        weight: '50.75',
        date_recorded: '2024-06-15',
        recorded_by: testData.teacher.user_id
      });

    const input: GradeReportInput = {
      academic_year: '2024/2025'
    };

    const result = await getGradeReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].score).toEqual(87.25);
    expect(result[0].max_score).toEqual(100);
    expect(result[0].weight).toEqual(50.75);
    expect(typeof result[0].score).toBe('number');
    expect(typeof result[0].max_score).toBe('number');
    expect(typeof result[0].weight).toBe('number');
  });
});