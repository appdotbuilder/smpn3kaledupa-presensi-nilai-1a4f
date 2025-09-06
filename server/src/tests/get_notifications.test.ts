import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, parentsTable, studentsTable, classesTable, notificationsTable } from '../db/schema';
import { getNotifications } from '../handlers/get_notifications';
import { eq } from 'drizzle-orm';

describe('getNotifications', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'parent1@test.com',
          password: 'password123',
          name: 'Parent One',
          role: 'parent'
        },
        {
          email: 'parent2@test.com',
          password: 'password123',
          name: 'Parent Two',
          role: 'parent'
        },
        {
          email: 'student1@test.com',
          password: 'password123',
          name: 'Student One',
          role: 'student'
        },
        {
          email: 'student2@test.com',
          password: 'password123',
          name: 'Student Two',
          role: 'student'
        }
      ])
      .returning()
      .execute();

    // Create class
    const classes = await db.insert(classesTable)
      .values({
        name: 'Class 7A',
        grade_level: 7,
        academic_year: '2024/2025'
      })
      .returning()
      .execute();

    // Create parents
    const parents = await db.insert(parentsTable)
      .values([
        {
          user_id: users[0].id,
          phone_number: '081234567890'
        },
        {
          user_id: users[1].id,
          phone_number: '081234567891'
        }
      ])
      .returning()
      .execute();

    // Create students
    const students = await db.insert(studentsTable)
      .values([
        {
          user_id: users[2].id,
          student_number: 'STU001',
          class_id: classes[0].id,
          parent_id: parents[0].id
        },
        {
          user_id: users[3].id,
          student_number: 'STU002',
          class_id: classes[0].id,
          parent_id: parents[1].id
        }
      ])
      .returning()
      .execute();

    return { users, parents, students, classes };
  };

  it('should return all notifications when no parent ID is provided', async () => {
    const { parents, students } = await createTestData();

    // Create notifications for both parents
    const notifications = await db.insert(notificationsTable)
      .values([
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Your child was absent today',
          type: 'attendance',
          status: 'sent'
        },
        {
          parent_id: parents[1].id,
          student_id: students[1].id,
          message: 'New grade recorded',
          type: 'grade',
          status: 'pending'
        },
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'General announcement',
          type: 'general',
          status: 'sent'
        }
      ])
      .returning()
      .execute();

    const result = await getNotifications();

    expect(result).toHaveLength(3);
    expect(result[0].parent_id).toBeDefined();
    expect(result[0].student_id).toBeDefined();
    expect(result[0].message).toBeDefined();
    expect(result[0].type).toBeDefined();
    expect(result[0].status).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return notifications for specific parent', async () => {
    const { parents, students } = await createTestData();

    // Create notifications for both parents
    await db.insert(notificationsTable)
      .values([
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Your child was absent today',
          type: 'attendance',
          status: 'sent'
        },
        {
          parent_id: parents[1].id,
          student_id: students[1].id,
          message: 'New grade recorded',
          type: 'grade',
          status: 'pending'
        },
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'General announcement',
          type: 'general',
          status: 'sent'
        }
      ])
      .returning()
      .execute();

    const result = await getNotifications(parents[0].id);

    expect(result).toHaveLength(2);
    result.forEach(notification => {
      expect(notification.parent_id).toEqual(parents[0].id);
      expect(notification.student_id).toEqual(students[0].id);
    });

    // Verify specific messages are returned
    const messages = result.map(n => n.message);
    expect(messages).toContain('Your child was absent today');
    expect(messages).toContain('General announcement');
    expect(messages).not.toContain('New grade recorded');
  });

  it('should return empty array when parent has no notifications', async () => {
    const { parents } = await createTestData();

    const result = await getNotifications(parents[0].id);

    expect(result).toHaveLength(0);
  });

  it('should return notifications ordered by created_at descending', async () => {
    const { parents, students } = await createTestData();

    // Create notifications with different timestamps
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await db.insert(notificationsTable)
      .values([
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Oldest notification',
          type: 'general',
          status: 'sent'
        },
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Newest notification',
          type: 'general',
          status: 'sent'
        },
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Middle notification',
          type: 'general',
          status: 'sent'
        }
      ])
      .returning()
      .execute();

    const result = await getNotifications(parents[0].id);

    expect(result).toHaveLength(3);
    
    // Verify that notifications are ordered by created_at descending (newest first)
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].created_at >= result[i + 1].created_at).toBe(true);
    }
  });

  it('should handle different notification types and statuses', async () => {
    const { parents, students } = await createTestData();

    const notifications = await db.insert(notificationsTable)
      .values([
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Attendance notification',
          type: 'attendance',
          status: 'sent'
        },
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Grade notification',
          type: 'grade',
          status: 'pending'
        },
        {
          parent_id: parents[0].id,
          student_id: students[0].id,
          message: 'Failed notification',
          type: 'general',
          status: 'failed'
        }
      ])
      .returning()
      .execute();

    const result = await getNotifications(parents[0].id);

    expect(result).toHaveLength(3);

    const types = result.map(n => n.type);
    const statuses = result.map(n => n.status);

    expect(types).toContain('attendance');
    expect(types).toContain('grade');
    expect(types).toContain('general');

    expect(statuses).toContain('sent');
    expect(statuses).toContain('pending');
    expect(statuses).toContain('failed');
  });

  it('should return empty array for non-existent parent', async () => {
    await createTestData();

    const result = await getNotifications(999);

    expect(result).toHaveLength(0);
  });

  it('should include all required notification fields', async () => {
    const { parents, students } = await createTestData();

    const now = new Date();
    
    await db.insert(notificationsTable)
      .values({
        parent_id: parents[0].id,
        student_id: students[0].id,
        message: 'Test notification with sent_at',
        type: 'attendance',
        status: 'sent',
        sent_at: now
      })
      .returning()
      .execute();

    const result = await getNotifications(parents[0].id);

    expect(result).toHaveLength(1);
    
    const notification = result[0];
    expect(notification.id).toBeDefined();
    expect(notification.parent_id).toEqual(parents[0].id);
    expect(notification.student_id).toEqual(students[0].id);
    expect(notification.message).toEqual('Test notification with sent_at');
    expect(notification.type).toEqual('attendance');
    expect(notification.status).toEqual('sent');
    expect(notification.sent_at).toBeInstanceOf(Date);
    expect(notification.created_at).toBeInstanceOf(Date);
  });

  it('should handle notifications with null sent_at', async () => {
    const { parents, students } = await createTestData();

    await db.insert(notificationsTable)
      .values({
        parent_id: parents[0].id,
        student_id: students[0].id,
        message: 'Pending notification',
        type: 'general',
        status: 'pending'
        // sent_at will be null
      })
      .returning()
      .execute();

    const result = await getNotifications(parents[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].sent_at).toBeNull();
    expect(result[0].status).toEqual('pending');
  });
});