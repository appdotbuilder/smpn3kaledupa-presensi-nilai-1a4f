import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, parentsTable, studentsTable, classesTable, notificationsTable } from '../db/schema';
import { type CreateNotificationInput } from '../schema';
import { createNotification } from '../handlers/create_notification';
import { eq } from 'drizzle-orm';

describe('createNotification', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create users
    const userResults = await db.insert(usersTable).values([
      {
        email: 'parent@test.com',
        password: 'password123',
        name: 'Test Parent',
        role: 'parent'
      },
      {
        email: 'student@test.com',
        password: 'password123',
        name: 'Test Student',
        role: 'student'
      }
    ]).returning().execute();

    const parentUser = userResults[0];
    const studentUser = userResults[1];

    // Create class
    const classResults = await db.insert(classesTable).values({
      name: '7A',
      grade_level: 7,
      academic_year: '2024/2025'
    }).returning().execute();

    const testClass = classResults[0];

    // Create parent
    const parentResults = await db.insert(parentsTable).values({
      user_id: parentUser.id,
      phone_number: '081234567890'
    }).returning().execute();

    const parent = parentResults[0];

    // Create student
    const studentResults = await db.insert(studentsTable).values({
      user_id: studentUser.id,
      student_number: 'STU001',
      class_id: testClass.id,
      parent_id: parent.id
    }).returning().execute();

    const student = studentResults[0];

    return { parent, student };
  };

  it('should create a notification successfully', async () => {
    const { parent, student } = await createTestData();

    const testInput: CreateNotificationInput = {
      parent_id: parent.id,
      student_id: student.id,
      message: 'Your child was absent from Math class today.',
      type: 'attendance'
    };

    const result = await createNotification(testInput);

    // Basic field validation
    expect(result.parent_id).toEqual(parent.id);
    expect(result.student_id).toEqual(student.id);
    expect(result.message).toEqual('Your child was absent from Math class today.');
    expect(result.type).toEqual('attendance');
    expect(result.status).toEqual('pending');
    expect(result.sent_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save notification to database', async () => {
    const { parent, student } = await createTestData();

    const testInput: CreateNotificationInput = {
      parent_id: parent.id,
      student_id: student.id,
      message: 'Grade update: Your child scored 85 in English quiz.',
      type: 'grade'
    };

    const result = await createNotification(testInput);

    // Query database to verify notification was saved
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, result.id))
      .execute();

    expect(notifications).toHaveLength(1);
    const savedNotification = notifications[0];
    expect(savedNotification.parent_id).toEqual(parent.id);
    expect(savedNotification.student_id).toEqual(student.id);
    expect(savedNotification.message).toEqual('Grade update: Your child scored 85 in English quiz.');
    expect(savedNotification.type).toEqual('grade');
    expect(savedNotification.status).toEqual('pending');
    expect(savedNotification.sent_at).toBeNull();
    expect(savedNotification.created_at).toBeInstanceOf(Date);
  });

  it('should create notification with general type', async () => {
    const { parent, student } = await createTestData();

    const testInput: CreateNotificationInput = {
      parent_id: parent.id,
      student_id: student.id,
      message: 'Parent-teacher meeting scheduled for next week.',
      type: 'general'
    };

    const result = await createNotification(testInput);

    expect(result.type).toEqual('general');
    expect(result.message).toEqual('Parent-teacher meeting scheduled for next week.');
    expect(result.status).toEqual('pending');
  });

  it('should throw error when parent does not exist', async () => {
    const { student } = await createTestData();

    const testInput: CreateNotificationInput = {
      parent_id: 99999, // Non-existent parent ID
      student_id: student.id,
      message: 'Test notification',
      type: 'attendance'
    };

    await expect(createNotification(testInput)).rejects.toThrow(/Parent with ID 99999 not found/i);
  });

  it('should throw error when student does not exist', async () => {
    const { parent } = await createTestData();

    const testInput: CreateNotificationInput = {
      parent_id: parent.id,
      student_id: 99999, // Non-existent student ID
      message: 'Test notification',
      type: 'grade'
    };

    await expect(createNotification(testInput)).rejects.toThrow(/Student with ID 99999 not found/i);
  });

  it('should handle different notification types correctly', async () => {
    const { parent, student } = await createTestData();

    const notificationTypes = ['attendance', 'grade', 'general'];
    const messages = [
      'Attendance notification message',
      'Grade notification message', 
      'General notification message'
    ];

    for (let i = 0; i < notificationTypes.length; i++) {
      const testInput: CreateNotificationInput = {
        parent_id: parent.id,
        student_id: student.id,
        message: messages[i],
        type: notificationTypes[i]
      };

      const result = await createNotification(testInput);

      expect(result.type).toEqual(notificationTypes[i]);
      expect(result.message).toEqual(messages[i]);
      expect(result.status).toEqual('pending');
      expect(result.sent_at).toBeNull();
    }
  });

  it('should handle long messages correctly', async () => {
    const { parent, student } = await createTestData();

    const longMessage = 'This is a very long notification message that contains detailed information about the student\'s performance and behavior in class. It includes multiple sentences and provides comprehensive feedback for the parent to review and understand their child\'s academic progress.';

    const testInput: CreateNotificationInput = {
      parent_id: parent.id,
      student_id: student.id,
      message: longMessage,
      type: 'general'
    };

    const result = await createNotification(testInput);

    expect(result.message).toEqual(longMessage);
    expect(result.message.length).toBeGreaterThan(200);
  });
});