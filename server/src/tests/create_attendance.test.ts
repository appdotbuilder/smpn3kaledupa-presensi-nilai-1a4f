import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  attendancesTable, 
  usersTable, 
  studentsTable, 
  classesTable,
  parentsTable, 
  notificationsTable 
} from '../db/schema';
import { type CreateAttendanceInput } from '../schema';
import { createAttendance } from '../handlers/create_attendance';
import { eq } from 'drizzle-orm';

// Test data setup
let testUserId: number;
let testParentId: number;
let testParentUserId: number;
let testStudentId: number;
let testClassId: number;
let testRecorderId: number;

// Simple test input for present attendance
const testInput: CreateAttendanceInput = {
  student_id: 0, // Will be set in beforeEach
  subject_id: null,
  date: new Date('2024-01-15'),
  status: 'present',
  notes: 'Student was present',
  recorded_by: 0 // Will be set in beforeEach
};

describe('createAttendance', () => {
  beforeEach(async () => {
    await createDB();

    // Create test class
    const classResult = await db.insert(classesTable)
      .values({
        name: 'Grade 8A',
        grade_level: 8,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();
    testClassId = classResult[0].id;

    // Create test student user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'student@test.com',
        password: 'password123',
        name: 'Test Student',
        role: 'student'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test parent user
    const parentUserResult = await db.insert(usersTable)
      .values({
        email: 'parent@test.com',
        password: 'password123',
        name: 'Test Parent',
        role: 'parent'
      })
      .returning()
      .execute();
    testParentUserId = parentUserResult[0].id;

    // Create test parent
    const parentResult = await db.insert(parentsTable)
      .values({
        user_id: testParentUserId,
        phone_number: '+1234567890'
      })
      .returning()
      .execute();
    testParentId = parentResult[0].id;

    // Create test student
    const studentResult = await db.insert(studentsTable)
      .values({
        user_id: testUserId,
        student_number: 'STU001',
        class_id: testClassId,
        parent_id: testParentId
      })
      .returning()
      .execute();
    testStudentId = studentResult[0].id;

    // Create recorder user (teacher)
    const recorderResult = await db.insert(usersTable)
      .values({
        email: 'teacher@test.com',
        password: 'password123',
        name: 'Test Teacher',
        role: 'teacher'
      })
      .returning()
      .execute();
    testRecorderId = recorderResult[0].id;

    // Update test input with actual IDs
    testInput.student_id = testStudentId;
    testInput.recorded_by = testRecorderId;
  });

  afterEach(resetDB);

  it('should create attendance record for present student', async () => {
    const result = await createAttendance(testInput);

    // Basic field validation
    expect(result.student_id).toEqual(testStudentId);
    expect(result.subject_id).toBeNull();
    expect(result.date).toEqual(new Date('2024-01-15')); // Handler returns Date object
    expect(result.status).toEqual('present');
    expect(result.notes).toEqual('Student was present');
    expect(result.recorded_by).toEqual(testRecorderId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save attendance to database', async () => {
    const result = await createAttendance(testInput);

    // Query using proper drizzle syntax
    const attendances = await db.select()
      .from(attendancesTable)
      .where(eq(attendancesTable.id, result.id))
      .execute();

    expect(attendances).toHaveLength(1);
    expect(attendances[0].student_id).toEqual(testStudentId);
    expect(attendances[0].status).toEqual('present');
    expect(attendances[0].date).toEqual('2024-01-15'); // Database stores as string
    expect(attendances[0].recorded_by).toEqual(testRecorderId);
    expect(attendances[0].created_at).toBeInstanceOf(Date);
  });

  it('should create notification when student is absent', async () => {
    const absentInput: CreateAttendanceInput = {
      ...testInput,
      status: 'absent',
      notes: 'Student was absent'
    };

    await createAttendance(absentInput);

    // Check if notification was created
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.parent_id, testParentId))
      .execute();

    expect(notifications).toHaveLength(1);
    expect(notifications[0].parent_id).toEqual(testParentId);
    expect(notifications[0].student_id).toEqual(testStudentId);
    expect(notifications[0].message).toContain('was marked absent');
    expect(notifications[0].message).toContain('2024-01-15');
    expect(notifications[0].type).toEqual('attendance');
    expect(notifications[0].status).toEqual('pending');
    expect(notifications[0].created_at).toBeInstanceOf(Date);
  });

  it('should not create notification when student is present', async () => {
    const presentInput: CreateAttendanceInput = {
      ...testInput,
      status: 'present'
    };

    await createAttendance(presentInput);

    // Check that no notification was created
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.parent_id, testParentId))
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should handle attendance with subject_id', async () => {
    const subjectAttendanceInput: CreateAttendanceInput = {
      ...testInput,
      subject_id: 1,
      status: 'late',
      notes: 'Student was late to class'
    };

    const result = await createAttendance(subjectAttendanceInput);

    expect(result.subject_id).toEqual(1);
    expect(result.status).toEqual('late');
    expect(result.notes).toEqual('Student was late to class');
  });

  it('should handle different attendance statuses', async () => {
    const statuses = ['present', 'absent', 'late', 'excused'] as const;

    for (const status of statuses) {
      const statusInput: CreateAttendanceInput = {
        ...testInput,
        status,
        notes: `Student was ${status}`
      };

      const result = await createAttendance(statusInput);
      expect(result.status).toEqual(status);
      expect(result.notes).toEqual(`Student was ${status}`);
    }
  });

  it('should handle student without parent (no notification)', async () => {
    // Create student without parent
    const userWithoutParent = await db.insert(usersTable)
      .values({
        email: 'orphan@test.com',
        password: 'password123',
        name: 'Orphan Student',
        role: 'student'
      })
      .returning()
      .execute();

    const studentWithoutParent = await db.insert(studentsTable)
      .values({
        user_id: userWithoutParent[0].id,
        student_number: 'STU002',
        class_id: testClassId,
        parent_id: null // No parent
      })
      .returning()
      .execute();

    const absentInput: CreateAttendanceInput = {
      ...testInput,
      student_id: studentWithoutParent[0].id,
      status: 'absent'
    };

    await createAttendance(absentInput);

    // Check that no notification was created
    const notifications = await db.select()
      .from(notificationsTable)
      .execute();

    expect(notifications).toHaveLength(0);
  });

  it('should throw error for non-existent student', async () => {
    const invalidInput: CreateAttendanceInput = {
      ...testInput,
      student_id: 99999 // Non-existent student
    };

    await expect(createAttendance(invalidInput)).rejects.toThrow(/Student with id 99999 not found/);
  });

  it('should handle null notes correctly', async () => {
    const nullNotesInput: CreateAttendanceInput = {
      ...testInput,
      notes: null
    };

    const result = await createAttendance(nullNotesInput);
    expect(result.notes).toBeNull();

    // Verify in database
    const attendances = await db.select()
      .from(attendancesTable)
      .where(eq(attendancesTable.id, result.id))
      .execute();

    expect(attendances[0].notes).toBeNull();
  });
});