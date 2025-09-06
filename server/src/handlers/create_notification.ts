import { db } from '../db';
import { notificationsTable, parentsTable, studentsTable } from '../db/schema';
import { type CreateNotificationInput, type Notification } from '../schema';
import { eq } from 'drizzle-orm';

export const createNotification = async (input: CreateNotificationInput): Promise<Notification> => {
  try {
    // Verify parent exists
    const parentExists = await db.select({ id: parentsTable.id })
      .from(parentsTable)
      .where(eq(parentsTable.id, input.parent_id))
      .execute();

    if (parentExists.length === 0) {
      throw new Error(`Parent with ID ${input.parent_id} not found`);
    }

    // Verify student exists
    const studentExists = await db.select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.id, input.student_id))
      .execute();

    if (studentExists.length === 0) {
      throw new Error(`Student with ID ${input.student_id} not found`);
    }

    // Insert notification record
    const result = await db.insert(notificationsTable)
      .values({
        parent_id: input.parent_id,
        student_id: input.student_id,
        message: input.message,
        type: input.type,
        status: 'pending',
        sent_at: null
      })
      .returning()
      .execute();

    const notification = result[0];
    return notification;
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
};