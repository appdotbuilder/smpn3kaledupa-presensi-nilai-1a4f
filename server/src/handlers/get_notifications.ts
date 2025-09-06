import { db } from '../db';
import { notificationsTable, studentsTable, usersTable } from '../db/schema';
import { type Notification } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getNotifications = async (parentId?: number): Promise<Notification[]> => {
  try {
    // Build the query differently to avoid TypeScript issues
    const baseQuery = db.select({
      id: notificationsTable.id,
      parent_id: notificationsTable.parent_id,
      student_id: notificationsTable.student_id,
      message: notificationsTable.message,
      type: notificationsTable.type,
      status: notificationsTable.status,
      sent_at: notificationsTable.sent_at,
      created_at: notificationsTable.created_at
    })
      .from(notificationsTable)
      .innerJoin(studentsTable, eq(notificationsTable.student_id, studentsTable.id))
      .innerJoin(usersTable, eq(studentsTable.user_id, usersTable.id))
      .orderBy(desc(notificationsTable.created_at));

    let results;
    
    if (parentId !== undefined) {
      results = await baseQuery
        .where(eq(notificationsTable.parent_id, parentId))
        .execute();
    } else {
      results = await baseQuery.execute();
    }

    return results;
  } catch (error) {
    console.error('Get notifications failed:', error);
    throw error;
  }
};