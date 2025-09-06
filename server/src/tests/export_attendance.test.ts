import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  studentsTable, 
  classesTable, 
  subjectsTable, 
  attendancesTable 
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { type ExportAttendanceInput } from '../handlers/export_attendance';
import { exportAttendance } from '../handlers/export_attendance';

describe('exportAttendance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test data
  const setupTestData = async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'admin@test.com',
          password: 'password123',
          name: 'Admin User',
          role: 'admin'
        },
        {
          email: 'student1@test.com',
          password: 'password123',
          name: 'John Doe',
          role: 'student'
        },
        {
          email: 'student2@test.com',
          password: 'password123',
          name: 'Jane Smith',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    // Create class
    const classes = await db.insert(classesTable)
      .values({
        name: '7A',
        grade_level: 7,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    // Create subject
    const subjects = await db.insert(subjectsTable)
      .values({
        name: 'Mathematics',
        code: 'MATH'
      })
      .returning()
      .execute();

    // Create students
    const students = await db.insert(studentsTable)
      .values([
        {
          user_id: users[1].id,
          student_number: 'STU001',
          class_id: classes[0].id,
          parent_id: null
        },
        {
          user_id: users[2].id,
          student_number: 'STU002',
          class_id: classes[0].id,
          parent_id: null
        }
      ])
      .returning()
      .execute();

    // Create attendance records
    const testDate1 = new Date('2024-03-15');
    const testDate2 = new Date('2024-03-16');
    const testDate3 = new Date('2024-03-17');

    await db.insert(attendancesTable)
      .values([
        {
          student_id: students[0].id,
          subject_id: subjects[0].id,
          date: testDate1.toISOString().split('T')[0],
          status: 'present',
          notes: null,
          recorded_by: users[0].id
        },
        {
          student_id: students[1].id,
          subject_id: subjects[0].id,
          date: testDate1.toISOString().split('T')[0],
          status: 'absent',
          notes: 'Sick leave',
          recorded_by: users[0].id
        },
        {
          student_id: students[0].id,
          subject_id: null, // General attendance
          date: testDate2.toISOString().split('T')[0],
          status: 'late',
          notes: 'Traffic jam',
          recorded_by: users[0].id
        },
        {
          student_id: students[1].id,
          subject_id: subjects[0].id,
          date: testDate3.toISOString().split('T')[0],
          status: 'excused',
          notes: null,
          recorded_by: users[0].id
        }
      ])
      .execute();

    return {
      users,
      classes,
      subjects,
      students,
      testDates: [testDate1, testDate2, testDate3]
    };
  };

  it('should export attendance data in Excel format', async () => {
    const testData = await setupTestData();
    
    const input: ExportAttendanceInput = {
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-03-31'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    
    expect(result).toBeInstanceOf(Buffer);
    
    // Convert buffer to string to check CSV content
    const csvContent = result.toString('utf-8');
    
    // Check CSV headers
    expect(csvContent).toMatch(/ID,Student Name,Student Number,Class,Subject,Date,Status,Notes/);
    
    // Check that data rows are present
    expect(csvContent).toMatch(/John Doe/);
    expect(csvContent).toMatch(/Jane Smith/);
    expect(csvContent).toMatch(/STU001/);
    expect(csvContent).toMatch(/STU002/);
    expect(csvContent).toMatch(/7A/);
    expect(csvContent).toMatch(/Mathematics/);
    expect(csvContent).toMatch(/present/);
    expect(csvContent).toMatch(/absent/);
    expect(csvContent).toMatch(/late/);
    expect(csvContent).toMatch(/excused/);
    
    // Check date format (YYYY-MM-DD)
    expect(csvContent).toMatch(/2024-03-15/);
    expect(csvContent).toMatch(/2024-03-16/);
    expect(csvContent).toMatch(/2024-03-17/);
    
    // Check notes handling
    expect(csvContent).toMatch(/Sick leave/);
    expect(csvContent).toMatch(/Traffic jam/);
  });

  it('should export attendance data in PDF format', async () => {
    const testData = await setupTestData();
    
    const input: ExportAttendanceInput = {
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-03-31'),
      format: 'pdf'
    };

    const result = await exportAttendance(input);
    
    expect(result).toBeInstanceOf(Buffer);
    
    // Convert buffer to string to check PDF content
    const pdfContent = result.toString('utf-8');
    
    // Check PDF headers and structure
    expect(pdfContent).toMatch(/Attendance Report/);
    expect(pdfContent).toMatch(/Period: .* - .*/);
    expect(pdfContent).toMatch(/Total Records: 4/);
    expect(pdfContent).toMatch(/Status Summary:/);
    expect(pdfContent).toMatch(/Detailed Records:/);
    
    // Check that student data is present
    expect(pdfContent).toMatch(/John Doe/);
    expect(pdfContent).toMatch(/Jane Smith/);
    expect(pdfContent).toMatch(/STU001/);
    expect(pdfContent).toMatch(/STU002/);
    
    // Check status summary
    expect(pdfContent).toMatch(/present: 1/);
    expect(pdfContent).toMatch(/absent: 1/);
    expect(pdfContent).toMatch(/late: 1/);
    expect(pdfContent).toMatch(/excused: 1/);
  });

  it('should filter by class_id correctly', async () => {
    const testData = await setupTestData();
    
    // Create another class and student for filtering test
    const otherClass = await db.insert(classesTable)
      .values({
        name: '8B',
        grade_level: 8,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    const otherUser = await db.insert(usersTable)
      .values({
        email: 'other@test.com',
        password: 'password123',
        name: 'Other Student',
        role: 'student'
      })
      .returning()
      .execute();

    const otherStudent = await db.insert(studentsTable)
      .values({
        user_id: otherUser[0].id,
        student_number: 'STU003',
        class_id: otherClass[0].id,
        parent_id: null
      })
      .returning()
      .execute();

    await db.insert(attendancesTable)
      .values({
        student_id: otherStudent[0].id,
        subject_id: testData.subjects[0].id,
        date: new Date('2024-03-15').toISOString().split('T')[0],
        status: 'present',
        notes: null,
        recorded_by: testData.users[0].id
      })
      .execute();

    const input: ExportAttendanceInput = {
      class_id: testData.classes[0].id,
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-03-31'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    const csvContent = result.toString('utf-8');
    
    // Should only contain students from class 7A, not 8B
    expect(csvContent).toMatch(/7A/);
    expect(csvContent).not.toMatch(/8B/);
    expect(csvContent).not.toMatch(/Other Student/);
  });

  it('should filter by student_id correctly', async () => {
    const testData = await setupTestData();
    
    const input: ExportAttendanceInput = {
      student_id: testData.students[0].id,
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-03-31'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    const csvContent = result.toString('utf-8');
    
    // Should only contain records for John Doe (STU001)
    expect(csvContent).toMatch(/John Doe/);
    expect(csvContent).toMatch(/STU001/);
    expect(csvContent).not.toMatch(/Jane Smith/);
    expect(csvContent).not.toMatch(/STU002/);
  });

  it('should filter by subject_id correctly', async () => {
    const testData = await setupTestData();
    
    const input: ExportAttendanceInput = {
      subject_id: testData.subjects[0].id,
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-03-31'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    const csvContent = result.toString('utf-8');
    
    // Should only contain subject-specific attendance, not general attendance
    expect(csvContent).toMatch(/Mathematics/);
    expect(csvContent).toMatch(/present/);
    expect(csvContent).toMatch(/absent/);
    expect(csvContent).toMatch(/excused/);
    expect(csvContent).not.toMatch(/late/); // This was general attendance
  });

  it('should handle all records when subject_id is not specified', async () => {
    const testData = await setupTestData();
    
    const input: ExportAttendanceInput = {
      // subject_id not specified - should return all records
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-03-31'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    const csvContent = result.toString('utf-8');
    
    // Should contain both subject-specific and general attendance
    expect(csvContent).toMatch(/late/); // General attendance
    expect(csvContent).toMatch(/Mathematics/); // Subject-specific attendance
    expect(csvContent).toMatch(/present/);
    expect(csvContent).toMatch(/absent/);
    expect(csvContent).toMatch(/excused/);
  });

  it('should respect date range filters', async () => {
    const testData = await setupTestData();
    
    // Filter for only one day
    const input: ExportAttendanceInput = {
      start_date: new Date('2024-03-15'),
      end_date: new Date('2024-03-15'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    const csvContent = result.toString('utf-8');
    
    // Should only contain records from March 15
    expect(csvContent).toMatch(/2024-03-15/);
    expect(csvContent).not.toMatch(/2024-03-16/);
    expect(csvContent).not.toMatch(/2024-03-17/);
    
    // Should contain both students' records from that date
    expect(csvContent).toMatch(/present/);
    expect(csvContent).toMatch(/absent/);
  });

  it('should handle empty results gracefully', async () => {
    await setupTestData();
    
    // Query for a date range with no attendance records
    const input: ExportAttendanceInput = {
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    const csvContent = result.toString('utf-8');
    
    // Should contain headers but no data rows
    expect(csvContent).toMatch(/ID,Student Name,Student Number,Class,Subject,Date,Status,Notes/);
    
    // Count lines - should only have header line
    const lines = csvContent.trim().split('\n');
    expect(lines.length).toBe(1);
  });

  it('should handle CSV escaping correctly', async () => {
    const testData = await setupTestData();
    
    // Update a student with quotes in the name
    await db.update(attendancesTable)
      .set({ notes: 'Student said "I\'m sick"' })
      .where(eq(attendancesTable.id, 1))
      .execute();
    
    const input: ExportAttendanceInput = {
      start_date: new Date('2024-03-01'),
      end_date: new Date('2024-03-31'),
      format: 'excel'
    };

    const result = await exportAttendance(input);
    const csvContent = result.toString('utf-8');
    
    // Should properly escape quotes in notes
    expect(csvContent).toMatch(/Student said ""I'm sick""/);
  });

  it('should combine multiple filters correctly', async () => {
    const testData = await setupTestData();
    
    const input: ExportAttendanceInput = {
      class_id: testData.classes[0].id,
      subject_id: testData.subjects[0].id,
      student_id: testData.students[0].id,
      start_date: new Date('2024-03-15'),
      end_date: new Date('2024-03-15'),
      format: 'pdf'
    };

    const result = await exportAttendance(input);
    const pdfContent = result.toString('utf-8');
    
    // Should only contain one record matching all filters
    expect(pdfContent).toMatch(/Total Records: 1/);
    expect(pdfContent).toMatch(/John Doe/);
    expect(pdfContent).toMatch(/STU001/);
    expect(pdfContent).toMatch(/Mathematics/);
    expect(pdfContent).toMatch(/present: 1/);
  });
});