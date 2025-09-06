import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  studentsTable, 
  classesTable, 
  subjectsTable,
  attendancesTable,
  notificationsTable,
  parentsTable
} from '../db/schema';
import { type BulkAttendanceInput } from '../schema';
import { bulkCreateAttendance } from '../handlers/bulk_create_attendance';
import { eq } from 'drizzle-orm';

// Test setup data
const testUser1 = {
  email: 'student1@test.com',
  password: 'password123',
  name: 'Student One',
  role: 'student' as const
};

const testUser2 = {
  email: 'student2@test.com',
  password: 'password123',
  name: 'Student Two',
  role: 'student' as const
};

const testTeacherUser = {
  email: 'teacher@test.com',
  password: 'password123',
  name: 'Teacher One',
  role: 'teacher' as const
};

const testParentUser = {
  email: 'parent@test.com',
  password: 'password123',
  name: 'Parent One',
  role: 'parent' as const
};

const testClass = {
  name: 'Class 7A',
  grade_level: 7,
  academic_year: '2024/2025'
};

const testSubject = {
  name: 'Mathematics',
  code: 'MATH001'
};

describe('bulkCreateAttendance', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create multiple attendance records successfully', async () => {
    // Create prerequisite data
    const [user1, user2, teacher] = await db.insert(usersTable)
      .values([testUser1, testUser2, testTeacherUser])
      .returning()
      .execute();

    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    const [subject] = await db.insert(subjectsTable)
      .values(testSubject)
      .returning()
      .execute();

    const [student1, student2] = await db.insert(studentsTable)
      .values([
        {
          user_id: user1.id,
          student_number: 'STU001',
          class_id: testClassRecord.id,
          parent_id: null
        },
        {
          user_id: user2.id,
          student_number: 'STU002',
          class_id: testClassRecord.id,
          parent_id: null
        }
      ])
      .returning()
      .execute();

    const attendanceDate = new Date('2024-01-15');
    const input: BulkAttendanceInput = {
      attendances: [
        {
          student_id: student1.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'present',
          notes: null,
          recorded_by: teacher.id
        },
        {
          student_id: student2.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'absent',
          notes: 'Sick',
          recorded_by: teacher.id
        }
      ],
      date: attendanceDate,
      subject_id: subject.id,
      recorded_by: teacher.id
    };

    const results = await bulkCreateAttendance(input);

    // Verify results
    expect(results).toHaveLength(2);
    expect(results[0].student_id).toBe(student1.id);
    expect(results[0].status).toBe('present');
    expect(results[0].subject_id).toBe(subject.id);
    expect(results[0].date).toBeInstanceOf(Date);
    expect(results[0].recorded_by).toBe(teacher.id);
    expect(results[0].id).toBeDefined();
    expect(results[0].created_at).toBeInstanceOf(Date);

    expect(results[1].student_id).toBe(student2.id);
    expect(results[1].status).toBe('absent');
    expect(results[1].notes).toBe('Sick');
  });

  it('should save attendance records to database', async () => {
    // Create prerequisite data
    const [user1, teacher] = await db.insert(usersTable)
      .values([testUser1, testTeacherUser])
      .returning()
      .execute();

    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    const [subject] = await db.insert(subjectsTable)
      .values(testSubject)
      .returning()
      .execute();

    const [student1] = await db.insert(studentsTable)
      .values([{
        user_id: user1.id,
        student_number: 'STU001',
        class_id: testClassRecord.id,
        parent_id: null
      }])
      .returning()
      .execute();

    const attendanceDate = new Date('2024-01-15');
    const input: BulkAttendanceInput = {
      attendances: [
        {
          student_id: student1.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'late',
          notes: 'Traffic jam',
          recorded_by: teacher.id
        }
      ],
      date: attendanceDate,
      subject_id: subject.id,
      recorded_by: teacher.id
    };

    const results = await bulkCreateAttendance(input);

    // Verify data was saved to database
    const savedAttendance = await db.select()
      .from(attendancesTable)
      .where(eq(attendancesTable.id, results[0].id))
      .execute();

    expect(savedAttendance).toHaveLength(1);
    expect(savedAttendance[0].student_id).toBe(student1.id);
    expect(savedAttendance[0].status).toBe('late');
    expect(savedAttendance[0].notes).toBe('Traffic jam');
    expect(savedAttendance[0].date).toBe('2024-01-15');
    expect(savedAttendance[0].recorded_by).toBe(teacher.id);
  });

  it('should create notifications for absent students with parents', async () => {
    // Create prerequisite data including parent
    const [user1, teacher, parentUser] = await db.insert(usersTable)
      .values([testUser1, testTeacherUser, testParentUser])
      .returning()
      .execute();

    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    const [subject] = await db.insert(subjectsTable)
      .values(testSubject)
      .returning()
      .execute();

    const [parent] = await db.insert(parentsTable)
      .values([{
        user_id: parentUser.id,
        phone_number: '+62812345678'
      }])
      .returning()
      .execute();

    const [student1] = await db.insert(studentsTable)
      .values([{
        user_id: user1.id,
        student_number: 'STU001',
        class_id: testClassRecord.id,
        parent_id: parent.id
      }])
      .returning()
      .execute();

    const attendanceDate = new Date('2024-01-15');
    const input: BulkAttendanceInput = {
      attendances: [
        {
          student_id: student1.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'absent',
          notes: 'Sick',
          recorded_by: teacher.id
        }
      ],
      date: attendanceDate,
      subject_id: subject.id,
      recorded_by: teacher.id
    };

    await bulkCreateAttendance(input);

    // Verify notification was created
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.parent_id, parent.id))
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].student_id).toBe(student1.id);
    expect(notifications[0].type).toBe('attendance');
    expect(notifications[0].status).toBe('pending');
    expect(notifications[0].message).toContain('absent');
    expect(notifications[0].message).toContain('2024-01-15');
  });

  it('should not create notifications for present students', async () => {
    // Create prerequisite data including parent
    const [user1, teacher, parentUser] = await db.insert(usersTable)
      .values([testUser1, testTeacherUser, testParentUser])
      .returning()
      .execute();

    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    const [subject] = await db.insert(subjectsTable)
      .values(testSubject)
      .returning()
      .execute();

    const [parent] = await db.insert(parentsTable)
      .values([{
        user_id: parentUser.id,
        phone_number: '+62812345678'
      }])
      .returning()
      .execute();

    const [student1] = await db.insert(studentsTable)
      .values([{
        user_id: user1.id,
        student_number: 'STU001',
        class_id: testClassRecord.id,
        parent_id: parent.id
      }])
      .returning()
      .execute();

    const attendanceDate = new Date('2024-01-15');
    const input: BulkAttendanceInput = {
      attendances: [
        {
          student_id: student1.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'present',
          notes: null,
          recorded_by: teacher.id
        }
      ],
      date: attendanceDate,
      subject_id: subject.id,
      recorded_by: teacher.id
    };

    await bulkCreateAttendance(input);

    // Verify no notifications were created
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.parent_id, parent.id))
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should not create notifications for students without parents', async () => {
    // Create prerequisite data without parent
    const [user1, teacher] = await db.insert(usersTable)
      .values([testUser1, testTeacherUser])
      .returning()
      .execute();

    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    const [subject] = await db.insert(subjectsTable)
      .values(testSubject)
      .returning()
      .execute();

    const [student1] = await db.insert(studentsTable)
      .values([{
        user_id: user1.id,
        student_number: 'STU001',
        class_id: testClassRecord.id,
        parent_id: null // No parent
      }])
      .returning()
      .execute();

    const attendanceDate = new Date('2024-01-15');
    const input: BulkAttendanceInput = {
      attendances: [
        {
          student_id: student1.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'absent',
          notes: 'Sick',
          recorded_by: teacher.id
        }
      ],
      date: attendanceDate,
      subject_id: subject.id,
      recorded_by: teacher.id
    };

    await bulkCreateAttendance(input);

    // Verify no notifications were created
    const notifications = await db.select()
      .from(notificationsTable)
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should handle mixed attendance statuses correctly', async () => {
    // Create prerequisite data
    const [user1, user2, user3, teacher, parentUser] = await db.insert(usersTable)
      .values([testUser1, testUser2, { ...testUser1, email: 'student3@test.com', name: 'Student Three' }, testTeacherUser, testParentUser])
      .returning()
      .execute();

    const [testClassRecord] = await db.insert(classesTable)
      .values(testClass)
      .returning()
      .execute();

    const [subject] = await db.insert(subjectsTable)
      .values(testSubject)
      .returning()
      .execute();

    const [parent] = await db.insert(parentsTable)
      .values([{
        user_id: parentUser.id,
        phone_number: '+62812345678'
      }])
      .returning()
      .execute();

    const [student1, student2, student3] = await db.insert(studentsTable)
      .values([
        {
          user_id: user1.id,
          student_number: 'STU001',
          class_id: testClassRecord.id,
          parent_id: parent.id
        },
        {
          user_id: user2.id,
          student_number: 'STU002',
          class_id: testClassRecord.id,
          parent_id: null
        },
        {
          user_id: user3.id,
          student_number: 'STU003',
          class_id: testClassRecord.id,
          parent_id: parent.id
        }
      ])
      .returning()
      .execute();

    const attendanceDate = new Date('2024-01-15');
    const input: BulkAttendanceInput = {
      attendances: [
        {
          student_id: student1.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'absent',
          notes: 'Sick',
          recorded_by: teacher.id
        },
        {
          student_id: student2.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'absent',
          notes: 'Family emergency',
          recorded_by: teacher.id
        },
        {
          student_id: student3.id,
          subject_id: subject.id,
          date: attendanceDate,
          status: 'present',
          notes: null,
          recorded_by: teacher.id
        }
      ],
      date: attendanceDate,
      subject_id: subject.id,
      recorded_by: teacher.id
    };

    const results = await bulkCreateAttendance(input);

    // Verify all attendance records were created
    expect(results).toHaveLength(3);

    // Verify only one notification was created (for student1 who has a parent and is absent)
    const notifications = await db.select()
      .from(notificationsTable)
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].parent_id).toBe(parent.id);
    expect(notifications[0].student_id).toBe(student1.id);
  });

  it('should throw error for invalid student IDs', async () => {
    // Create prerequisite data
    const [teacher] = await db.insert(usersTable)
      .values([testTeacherUser])
      .returning()
      .execute();

    const [subject] = await db.insert(subjectsTable)
      .values(testSubject)
      .returning()
      .execute();

    const attendanceDate = new Date('2024-01-15');
    const input: BulkAttendanceInput = {
      attendances: [
        {
          student_id: 999, // Non-existent student
          subject_id: subject.id,
          date: attendanceDate,
          status: 'present',
          notes: null,
          recorded_by: teacher.id
        }
      ],
      date: attendanceDate,
      subject_id: subject.id,
      recorded_by: teacher.id
    };

    await expect(bulkCreateAttendance(input)).rejects.toThrow(/Invalid student IDs/i);
  });
});