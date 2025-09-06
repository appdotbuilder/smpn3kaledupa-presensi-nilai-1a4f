import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, classesTable, subjectsTable, studentsTable, teachersTable, gradesTable } from '../db/schema';
import { type BulkGradeInput } from '../schema';
import { bulkCreateGrades } from '../handlers/bulk_create_grades';
import { eq } from 'drizzle-orm';

describe('bulkCreateGrades', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper to create prerequisite data
  const setupTestData = async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        { email: 'teacher@test.com', password: 'password123', name: 'Teacher One', role: 'teacher' },
        { email: 'student1@test.com', password: 'password123', name: 'Student One', role: 'student' },
        { email: 'student2@test.com', password: 'password123', name: 'Student Two', role: 'student' }
      ])
      .returning()
      .execute();

    // Create class
    const classes = await db.insert(classesTable)
      .values({ name: '7A', grade_level: 7, academic_year: '2024/2025' })
      .returning()
      .execute();

    // Create subject
    const subjects = await db.insert(subjectsTable)
      .values({ name: 'Mathematics', code: 'MATH' })
      .returning()
      .execute();

    // Create teacher
    const teachers = await db.insert(teachersTable)
      .values({ user_id: users[0].id, employee_number: 'T001' })
      .returning()
      .execute();

    // Create students
    const students = await db.insert(studentsTable)
      .values([
        { user_id: users[1].id, student_number: 'S001', class_id: classes[0].id, parent_id: null },
        { user_id: users[2].id, student_number: 'S002', class_id: classes[0].id, parent_id: null }
      ])
      .returning()
      .execute();

    return {
      teacher: teachers[0],
      subject: subjects[0],
      students,
      class: classes[0]
    };
  };

  it('should create multiple grades successfully', async () => {
    const { teacher, subject, students } = await setupTestData();

    const testInput: BulkGradeInput = {
      grades: [
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'daily',
          assignment_name: 'Quiz 1',
          score: 85.5,
          max_score: 100,
          weight: 10,
          date_recorded: new Date('2024-01-15'),
          recorded_by: teacher.user_id
        },
        {
          student_id: students[1].id,
          subject_id: subject.id,
          assignment_type: 'daily',
          assignment_name: 'Quiz 1',
          score: 92,
          max_score: 100,
          weight: 10,
          date_recorded: new Date('2024-01-15'),
          recorded_by: teacher.user_id
        }
      ]
    };

    const result = await bulkCreateGrades(testInput);

    // Verify all grades were created
    expect(result).toHaveLength(2);

    // Verify first grade
    expect(result[0].student_id).toEqual(students[0].id);
    expect(result[0].subject_id).toEqual(subject.id);
    expect(result[0].assignment_type).toEqual('daily');
    expect(result[0].assignment_name).toEqual('Quiz 1');
    expect(result[0].score).toEqual(85.5);
    expect(result[0].max_score).toEqual(100);
    expect(result[0].weight).toEqual(10);
    expect(result[0].recorded_by).toEqual(teacher.user_id);
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);

    // Verify second grade
    expect(result[1].student_id).toEqual(students[1].id);
    expect(result[1].score).toEqual(92);
    expect(result[1].max_score).toEqual(100);
    expect(result[1].weight).toEqual(10);

    // Verify numeric types
    expect(typeof result[0].score).toBe('number');
    expect(typeof result[0].max_score).toBe('number');
    expect(typeof result[0].weight).toBe('number');
  });

  it('should save all grades to database', async () => {
    const { teacher, subject, students } = await setupTestData();

    const testInput: BulkGradeInput = {
      grades: [
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'midterm',
          assignment_name: 'Midterm Exam',
          score: 78.25,
          max_score: 100,
          weight: 30,
          date_recorded: new Date('2024-02-15'),
          recorded_by: teacher.user_id
        },
        {
          student_id: students[1].id,
          subject_id: subject.id,
          assignment_type: 'midterm',
          assignment_name: 'Midterm Exam',
          score: 89.75,
          max_score: 100,
          weight: 30,
          date_recorded: new Date('2024-02-15'),
          recorded_by: teacher.user_id
        }
      ]
    };

    const result = await bulkCreateGrades(testInput);

    // Query database to verify grades were saved
    const savedGrades = await db.select()
      .from(gradesTable)
      .where(eq(gradesTable.subject_id, subject.id))
      .execute();

    expect(savedGrades).toHaveLength(2);
    
    // Check first saved grade
    const firstGrade = savedGrades.find(g => g.student_id === students[0].id);
    expect(firstGrade).toBeDefined();
    expect(firstGrade!.assignment_type).toEqual('midterm');
    expect(firstGrade!.assignment_name).toEqual('Midterm Exam');
    expect(parseFloat(firstGrade!.score)).toEqual(78.25);
    expect(parseFloat(firstGrade!.max_score)).toEqual(100);
    expect(parseFloat(firstGrade!.weight)).toEqual(30);

    // Check second saved grade
    const secondGrade = savedGrades.find(g => g.student_id === students[1].id);
    expect(secondGrade).toBeDefined();
    expect(parseFloat(secondGrade!.score)).toEqual(89.75);
  });

  it('should handle different assignment types', async () => {
    const { teacher, subject, students } = await setupTestData();

    const testInput: BulkGradeInput = {
      grades: [
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'final',
          assignment_name: 'Final Project',
          score: 95,
          max_score: 100,
          weight: 40,
          date_recorded: new Date('2024-06-15'),
          recorded_by: teacher.user_id
        }
      ]
    };

    const result = await bulkCreateGrades(testInput);

    expect(result).toHaveLength(1);
    expect(result[0].assignment_type).toEqual('final');
    expect(result[0].assignment_name).toEqual('Final Project');
    expect(result[0].weight).toEqual(40);
  });

  it('should handle decimal scores and weights correctly', async () => {
    const { teacher, subject, students } = await setupTestData();

    const testInput: BulkGradeInput = {
      grades: [
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'daily',
          assignment_name: 'Homework 1',
          score: 87.33,
          max_score: 90.5,
          weight: 7.25,
          date_recorded: new Date('2024-03-10'),
          recorded_by: teacher.user_id
        }
      ]
    };

    const result = await bulkCreateGrades(testInput);

    expect(result[0].score).toEqual(87.33);
    expect(result[0].max_score).toEqual(90.5);
    expect(result[0].weight).toEqual(7.25);
    
    // Verify precision is maintained in database
    const savedGrade = await db.select()
      .from(gradesTable)
      .where(eq(gradesTable.id, result[0].id))
      .execute();
    
    expect(parseFloat(savedGrade[0].score)).toEqual(87.33);
    expect(parseFloat(savedGrade[0].max_score)).toEqual(90.5);
    expect(parseFloat(savedGrade[0].weight)).toEqual(7.25);
  });

  it('should handle empty grades array', async () => {
    const testInput: BulkGradeInput = {
      grades: []
    };

    const result = await bulkCreateGrades(testInput);
    
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should create grades with large assignment names', async () => {
    const { teacher, subject, students } = await setupTestData();

    const testInput: BulkGradeInput = {
      grades: [
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'daily',
          assignment_name: 'Very Long Assignment Name That Tests String Handling',
          score: 85,
          max_score: 100,
          weight: 10,
          date_recorded: new Date('2024-01-15'),
          recorded_by: teacher.user_id
        }
      ]
    };

    const result = await bulkCreateGrades(testInput);
    
    expect(result).toHaveLength(1);
    expect(result[0].assignment_name).toEqual('Very Long Assignment Name That Tests String Handling');
  });

  it('should handle multiple grades for same student and subject', async () => {
    const { teacher, subject, students } = await setupTestData();

    const testInput: BulkGradeInput = {
      grades: [
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'daily',
          assignment_name: 'Quiz 1',
          score: 85,
          max_score: 100,
          weight: 10,
          date_recorded: new Date('2024-01-15'),
          recorded_by: teacher.user_id
        },
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'daily',
          assignment_name: 'Quiz 2',
          score: 90,
          max_score: 100,
          weight: 10,
          date_recorded: new Date('2024-01-20'),
          recorded_by: teacher.user_id
        }
      ]
    };

    const result = await bulkCreateGrades(testInput);
    
    expect(result).toHaveLength(2);
    expect(result[0].assignment_name).toEqual('Quiz 1');
    expect(result[1].assignment_name).toEqual('Quiz 2');
    
    // Verify both grades are saved in database
    const savedGrades = await db.select()
      .from(gradesTable)
      .where(eq(gradesTable.student_id, students[0].id))
      .execute();
    
    expect(savedGrades).toHaveLength(2);
  });

  it('should handle zero scores correctly', async () => {
    const { teacher, subject, students } = await setupTestData();

    const testInput: BulkGradeInput = {
      grades: [
        {
          student_id: students[0].id,
          subject_id: subject.id,
          assignment_type: 'daily',
          assignment_name: 'Pop Quiz',
          score: 0,
          max_score: 50,
          weight: 5,
          date_recorded: new Date('2024-01-15'),
          recorded_by: teacher.user_id
        }
      ]
    };

    const result = await bulkCreateGrades(testInput);
    
    expect(result[0].score).toEqual(0);
    expect(typeof result[0].score).toBe('number');
  });
});