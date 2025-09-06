import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { gradesTable, usersTable, classesTable, studentsTable, subjectsTable } from '../db/schema';
import { type CreateGradeInput } from '../schema';
import { createGrade } from '../handlers/create_grade';
import { eq } from 'drizzle-orm';

describe('createGrade', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  const createPrerequisites = async () => {
    // Create a user for the student
    const studentUser = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password: 'password123',
        name: 'Test Student',
        role: 'student'
      })
      .returning()
      .execute();

    // Create a user for the teacher/recorder
    const teacherUser = await db.insert(usersTable)
      .values({
        email: 'teacher@test.com',
        password: 'password123',
        name: 'Test Teacher',
        role: 'teacher'
      })
      .returning()
      .execute();

    // Create a class
    const testClass = await db.insert(classesTable)
      .values({
        name: 'Grade 8A',
        grade_level: 8,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    // Create a student
    const student = await db.insert(studentsTable)
      .values({
        user_id: studentUser[0].id,
        student_number: 'STD001',
        class_id: testClass[0].id
      })
      .returning()
      .execute();

    // Create a subject
    const subject = await db.insert(subjectsTable)
      .values({
        name: 'Mathematics',
        code: 'MATH'
      })
      .returning()
      .execute();

    return {
      student: student[0],
      subject: subject[0],
      teacher: teacherUser[0]
    };
  };

  it('should create a grade successfully', async () => {
    const { student, subject, teacher } = await createPrerequisites();

    const testInput: CreateGradeInput = {
      student_id: student.id,
      subject_id: subject.id,
      assignment_type: 'daily',
      assignment_name: 'Quiz 1',
      score: 85.5,
      max_score: 100,
      weight: 10.5,
      date_recorded: new Date('2024-01-15'),
      recorded_by: teacher.id
    };

    const result = await createGrade(testInput);

    // Basic field validation
    expect(result.student_id).toEqual(student.id);
    expect(result.subject_id).toEqual(subject.id);
    expect(result.assignment_type).toEqual('daily');
    expect(result.assignment_name).toEqual('Quiz 1');
    expect(result.score).toEqual(85.5);
    expect(result.max_score).toEqual(100);
    expect(result.weight).toEqual(10.5);
    expect(result.date_recorded).toEqual(new Date('2024-01-15'));
    expect(result.recorded_by).toEqual(teacher.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify numeric types
    expect(typeof result.score).toBe('number');
    expect(typeof result.max_score).toBe('number');
    expect(typeof result.weight).toBe('number');
  });

  it('should save grade to database correctly', async () => {
    const { student, subject, teacher } = await createPrerequisites();

    const testInput: CreateGradeInput = {
      student_id: student.id,
      subject_id: subject.id,
      assignment_type: 'midterm',
      assignment_name: 'Midterm Exam',
      score: 92.75,
      max_score: 100,
      weight: 25,
      date_recorded: new Date('2024-02-15'),
      recorded_by: teacher.id
    };

    const result = await createGrade(testInput);

    // Query database directly to verify storage
    const grades = await db.select()
      .from(gradesTable)
      .where(eq(gradesTable.id, result.id))
      .execute();

    expect(grades).toHaveLength(1);
    const dbGrade = grades[0];
    
    expect(dbGrade.student_id).toEqual(student.id);
    expect(dbGrade.subject_id).toEqual(subject.id);
    expect(dbGrade.assignment_type).toEqual('midterm');
    expect(dbGrade.assignment_name).toEqual('Midterm Exam');
    expect(parseFloat(dbGrade.score)).toEqual(92.75); // Database stores as string
    expect(parseFloat(dbGrade.max_score)).toEqual(100);
    expect(parseFloat(dbGrade.weight)).toEqual(25);
    expect(new Date(dbGrade.date_recorded)).toEqual(new Date('2024-02-15'));
    expect(dbGrade.recorded_by).toEqual(teacher.id);
    expect(dbGrade.created_at).toBeInstanceOf(Date);
  });

  it('should handle different assignment types', async () => {
    const { student, subject, teacher } = await createPrerequisites();

    const assignmentTypes = ['daily', 'midterm', 'final'];
    
    for (const type of assignmentTypes) {
      const testInput: CreateGradeInput = {
        student_id: student.id,
        subject_id: subject.id,
        assignment_type: type,
        assignment_name: `Test ${type}`,
        score: 80,
        max_score: 100,
        weight: 20,
        date_recorded: new Date('2024-01-15'),
        recorded_by: teacher.id
      };

      const result = await createGrade(testInput);
      expect(result.assignment_type).toEqual(type);
      expect(result.assignment_name).toEqual(`Test ${type}`);
    }
  });

  it('should handle decimal scores correctly', async () => {
    const { student, subject, teacher } = await createPrerequisites();

    const testInput: CreateGradeInput = {
      student_id: student.id,
      subject_id: subject.id,
      assignment_type: 'daily',
      assignment_name: 'Decimal Test',
      score: 87.33,
      max_score: 95.5,
      weight: 15.75,
      date_recorded: new Date('2024-01-20'),
      recorded_by: teacher.id
    };

    const result = await createGrade(testInput);

    expect(result.score).toEqual(87.33);
    expect(result.max_score).toEqual(95.5);
    expect(result.weight).toEqual(15.75);
    expect(typeof result.score).toBe('number');
    expect(typeof result.max_score).toBe('number');
    expect(typeof result.weight).toBe('number');
  });

  it('should throw error when student does not exist', async () => {
    const { subject, teacher } = await createPrerequisites();

    const testInput: CreateGradeInput = {
      student_id: 999, // Non-existent student
      subject_id: subject.id,
      assignment_type: 'daily',
      assignment_name: 'Test Assignment',
      score: 85,
      max_score: 100,
      weight: 10,
      date_recorded: new Date('2024-01-15'),
      recorded_by: teacher.id
    };

    await expect(createGrade(testInput)).rejects.toThrow(/student.*not found/i);
  });

  it('should throw error when subject does not exist', async () => {
    const { student, teacher } = await createPrerequisites();

    const testInput: CreateGradeInput = {
      student_id: student.id,
      subject_id: 999, // Non-existent subject
      assignment_type: 'daily',
      assignment_name: 'Test Assignment',
      score: 85,
      max_score: 100,
      weight: 10,
      date_recorded: new Date('2024-01-15'),
      recorded_by: teacher.id
    };

    await expect(createGrade(testInput)).rejects.toThrow(/subject.*not found/i);
  });

  it('should throw error when recorder does not exist', async () => {
    const { student, subject } = await createPrerequisites();

    const testInput: CreateGradeInput = {
      student_id: student.id,
      subject_id: subject.id,
      assignment_type: 'daily',
      assignment_name: 'Test Assignment',
      score: 85,
      max_score: 100,
      weight: 10,
      date_recorded: new Date('2024-01-15'),
      recorded_by: 999 // Non-existent user
    };

    await expect(createGrade(testInput)).rejects.toThrow(/user.*not found/i);
  });

  it('should create multiple grades for the same student', async () => {
    const { student, subject, teacher } = await createPrerequisites();

    const assignments = [
      { name: 'Quiz 1', score: 85, type: 'daily' },
      { name: 'Quiz 2', score: 90, type: 'daily' },
      { name: 'Midterm', score: 88, type: 'midterm' }
    ];

    for (const assignment of assignments) {
      const testInput: CreateGradeInput = {
        student_id: student.id,
        subject_id: subject.id,
        assignment_type: assignment.type,
        assignment_name: assignment.name,
        score: assignment.score,
        max_score: 100,
        weight: 20,
        date_recorded: new Date('2024-01-15'),
        recorded_by: teacher.id
      };

      const result = await createGrade(testInput);
      expect(result.assignment_name).toEqual(assignment.name);
      expect(result.score).toEqual(assignment.score);
      expect(result.assignment_type).toEqual(assignment.type);
    }

    // Verify all grades were created
    const allGrades = await db.select()
      .from(gradesTable)
      .where(eq(gradesTable.student_id, student.id))
      .execute();

    expect(allGrades).toHaveLength(3);
  });

  it('should preserve date accurately', async () => {
    const { student, subject, teacher } = await createPrerequisites();

    const specificDate = new Date('2024-03-15');
    const testInput: CreateGradeInput = {
      student_id: student.id,
      subject_id: subject.id,
      assignment_type: 'final',
      assignment_name: 'Final Exam',
      score: 95,
      max_score: 100,
      weight: 40,
      date_recorded: specificDate,
      recorded_by: teacher.id
    };

    const result = await createGrade(testInput);

    expect(result.date_recorded).toEqual(specificDate);
    expect(result.date_recorded.getTime()).toEqual(specificDate.getTime());
  });
});