import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  classesTable, 
  studentsTable, 
  subjectsTable, 
  attendancesTable 
} from '../db/schema';
import { type AttendanceReportInput } from '../schema';
import { getAttendanceReport } from '../handlers/get_attendance_report';

// Test data setup
const testUser = {
  email: 'student@test.com',
  password: 'password123',
  name: 'Test Student',
  role: 'student' as const
};

const testTeacher = {
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

const testDate1 = new Date('2024-01-15');
const testDate2 = new Date('2024-01-16');
const testDate3 = new Date('2024-01-17');

// String dates for database insertion
const testDateStr1 = '2024-01-15';
const testDateStr2 = '2024-01-16';
const testDateStr3 = '2024-01-17';

describe('getAttendanceReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return attendance records within date range', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacher] = await db.insert(usersTable).values(testTeacher).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [student] = await db.insert(studentsTable).values({
      user_id: user.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();

    // Create attendance records
    await db.insert(attendancesTable).values([
      {
        student_id: student.id,
        subject_id: subject.id,
        date: testDateStr1,
        status: 'present',
        notes: null,
        recorded_by: teacher.id
      },
      {
        student_id: student.id,
        subject_id: subject.id,
        date: testDateStr2,
        status: 'absent',
        notes: 'Sick',
        recorded_by: teacher.id
      },
      {
        student_id: student.id,
        subject_id: subject.id,
        date: testDateStr3,
        status: 'late',
        notes: null,
        recorded_by: teacher.id
      }
    ]).execute();

    const input: AttendanceReportInput = {
      start_date: testDate1,
      end_date: testDate2
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(2);
    expect(result[0].status).toEqual('present');
    expect(result[0].date).toEqual(testDate1);
    expect(result[1].status).toEqual('absent');
    expect(result[1].date).toEqual(testDate2);
    expect(result[1].notes).toEqual('Sick');
  });

  it('should filter by class_id correctly', async () => {
    // Create prerequisite data
    const [user1] = await db.insert(usersTable).values(testUser).returning().execute();
    const [user2] = await db.insert(usersTable).values({
      email: 'student2@test.com',
      password: 'password123',
      name: 'Test Student 2',
      role: 'student' as const
    }).returning().execute();
    const [teacher] = await db.insert(usersTable).values(testTeacher).returning().execute();
    
    const [class1] = await db.insert(classesTable).values(testClass).returning().execute();
    const [class2] = await db.insert(classesTable).values({
      name: 'Class 7B',
      grade_level: 7,
      academic_year: '2024/2025'
    }).returning().execute();
    
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    
    const [student1] = await db.insert(studentsTable).values({
      user_id: user1.id,
      student_number: 'STU001',
      class_id: class1.id,
      parent_id: null
    }).returning().execute();
    
    const [student2] = await db.insert(studentsTable).values({
      user_id: user2.id,
      student_number: 'STU002',
      class_id: class2.id,
      parent_id: null
    }).returning().execute();

    // Create attendance records for both students
    await db.insert(attendancesTable).values([
      {
        student_id: student1.id,
        subject_id: subject.id,
        date: testDateStr1,
        status: 'present',
        notes: null,
        recorded_by: teacher.id
      },
      {
        student_id: student2.id,
        subject_id: subject.id,
        date: testDateStr1,
        status: 'absent',
        notes: null,
        recorded_by: teacher.id
      }
    ]).execute();

    const input: AttendanceReportInput = {
      class_id: class1.id,
      start_date: testDate1,
      end_date: testDate1
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].student_id).toEqual(student1.id);
    expect(result[0].status).toEqual('present');
  });

  it('should filter by student_id correctly', async () => {
    // Create prerequisite data
    const [user1] = await db.insert(usersTable).values(testUser).returning().execute();
    const [user2] = await db.insert(usersTable).values({
      email: 'student2@test.com',
      password: 'password123',
      name: 'Test Student 2',
      role: 'student' as const
    }).returning().execute();
    const [teacher] = await db.insert(usersTable).values(testTeacher).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    
    const [student1] = await db.insert(studentsTable).values({
      user_id: user1.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();
    
    const [student2] = await db.insert(studentsTable).values({
      user_id: user2.id,
      student_number: 'STU002',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();

    // Create attendance records for both students
    await db.insert(attendancesTable).values([
      {
        student_id: student1.id,
        subject_id: subject.id,
        date: testDateStr1,
        status: 'present',
        notes: null,
        recorded_by: teacher.id
      },
      {
        student_id: student2.id,
        subject_id: subject.id,
        date: testDateStr1,
        status: 'absent',
        notes: null,
        recorded_by: teacher.id
      }
    ]).execute();

    const input: AttendanceReportInput = {
      student_id: student2.id,
      start_date: testDate1,
      end_date: testDate1
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].student_id).toEqual(student2.id);
    expect(result[0].status).toEqual('absent');
  });

  it('should filter by subject_id correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacher] = await db.insert(usersTable).values(testTeacher).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    
    const [subject1] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [subject2] = await db.insert(subjectsTable).values({
      name: 'Science',
      code: 'SCI7'
    }).returning().execute();
    
    const [student] = await db.insert(studentsTable).values({
      user_id: user.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();

    // Create attendance records for different subjects
    await db.insert(attendancesTable).values([
      {
        student_id: student.id,
        subject_id: subject1.id,
        date: testDateStr1,
        status: 'present',
        notes: null,
        recorded_by: teacher.id
      },
      {
        student_id: student.id,
        subject_id: subject2.id,
        date: testDateStr1,
        status: 'absent',
        notes: null,
        recorded_by: teacher.id
      }
    ]).execute();

    const input: AttendanceReportInput = {
      subject_id: subject1.id,
      start_date: testDate1,
      end_date: testDate1
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].subject_id).toEqual(subject1.id);
    expect(result[0].status).toEqual('present');
  });

  it('should handle multiple filters combined', async () => {
    // Create prerequisite data
    const [user1] = await db.insert(usersTable).values(testUser).returning().execute();
    const [user2] = await db.insert(usersTable).values({
      email: 'student2@test.com',
      password: 'password123',
      name: 'Test Student 2',
      role: 'student' as const
    }).returning().execute();
    const [teacher] = await db.insert(usersTable).values(testTeacher).returning().execute();
    
    const [class1] = await db.insert(classesTable).values(testClass).returning().execute();
    const [class2] = await db.insert(classesTable).values({
      name: 'Class 7B',
      grade_level: 7,
      academic_year: '2024/2025'
    }).returning().execute();
    
    const [subject1] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    const [subject2] = await db.insert(subjectsTable).values({
      name: 'Science',
      code: 'SCI7'
    }).returning().execute();
    
    const [student1] = await db.insert(studentsTable).values({
      user_id: user1.id,
      student_number: 'STU001',
      class_id: class1.id,
      parent_id: null
    }).returning().execute();
    
    const [student2] = await db.insert(studentsTable).values({
      user_id: user2.id,
      student_number: 'STU002',
      class_id: class2.id,
      parent_id: null
    }).returning().execute();

    // Create multiple attendance records
    await db.insert(attendancesTable).values([
      {
        student_id: student1.id,
        subject_id: subject1.id,
        date: testDateStr1,
        status: 'present',
        notes: 'Target record',
        recorded_by: teacher.id
      },
      {
        student_id: student1.id,
        subject_id: subject2.id,
        date: testDateStr1,
        status: 'late',
        notes: 'Different subject',
        recorded_by: teacher.id
      },
      {
        student_id: student2.id,
        subject_id: subject1.id,
        date: testDateStr1,
        status: 'absent',
        notes: 'Different class',
        recorded_by: teacher.id
      }
    ]).execute();

    const input: AttendanceReportInput = {
      class_id: class1.id,
      subject_id: subject1.id,
      start_date: testDate1,
      end_date: testDate1
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].student_id).toEqual(student1.id);
    expect(result[0].subject_id).toEqual(subject1.id);
    expect(result[0].status).toEqual('present');
    expect(result[0].notes).toEqual('Target record');
  });

  it('should return empty array when no records match filters', async () => {
    // Create basic data but no matching attendance records
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [student] = await db.insert(studentsTable).values({
      user_id: user.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();

    const input: AttendanceReportInput = {
      student_id: student.id,
      start_date: testDate1,
      end_date: testDate2
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(0);
  });

  it('should handle null subject_id correctly', async () => {
    // Create prerequisite data
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [teacher] = await db.insert(usersTable).values(testTeacher).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [student] = await db.insert(studentsTable).values({
      user_id: user.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();

    // Create attendance record with null subject_id (general attendance)
    await db.insert(attendancesTable).values({
      student_id: student.id,
      subject_id: null,
      date: testDateStr1,
      status: 'present',
      notes: 'General attendance',
      recorded_by: teacher.id
    }).execute();

    const input: AttendanceReportInput = {
      start_date: testDate1,
      end_date: testDate1
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(1);
    expect(result[0].subject_id).toBeNull();
    expect(result[0].status).toEqual('present');
    expect(result[0].notes).toEqual('General attendance');
  });

  it('should order results by date and student consistently', async () => {
    // Create prerequisite data
    const [user1] = await db.insert(usersTable).values(testUser).returning().execute();
    const [user2] = await db.insert(usersTable).values({
      email: 'student2@test.com',
      password: 'password123',
      name: 'Test Student 2',
      role: 'student' as const
    }).returning().execute();
    const [teacher] = await db.insert(usersTable).values(testTeacher).returning().execute();
    const [testClassRecord] = await db.insert(classesTable).values(testClass).returning().execute();
    const [subject] = await db.insert(subjectsTable).values(testSubject).returning().execute();
    
    const [student1] = await db.insert(studentsTable).values({
      user_id: user1.id,
      student_number: 'STU001',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();
    
    const [student2] = await db.insert(studentsTable).values({
      user_id: user2.id,
      student_number: 'STU002',
      class_id: testClassRecord.id,
      parent_id: null
    }).returning().execute();

    // Create attendance records in mixed order
    await db.insert(attendancesTable).values([
      {
        student_id: student2.id,
        subject_id: subject.id,
        date: testDateStr2,
        status: 'present',
        notes: null,
        recorded_by: teacher.id
      },
      {
        student_id: student1.id,
        subject_id: subject.id,
        date: testDateStr1,
        status: 'absent',
        notes: null,
        recorded_by: teacher.id
      },
      {
        student_id: student1.id,
        subject_id: subject.id,
        date: testDateStr2,
        status: 'late',
        notes: null,
        recorded_by: teacher.id
      }
    ]).execute();

    const input: AttendanceReportInput = {
      start_date: testDate1,
      end_date: testDate2
    };

    const result = await getAttendanceReport(input);

    expect(result).toHaveLength(3);
    // Should be ordered by date first, then by student
    expect(result[0].date).toEqual(testDate1);
    expect(result[0].student_id).toEqual(student1.id);
    expect(result[1].date).toEqual(testDate2);
    expect(result[2].date).toEqual(testDate2);
  });
});