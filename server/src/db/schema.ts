import { serial, text, pgTable, timestamp, integer, pgEnum, numeric, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'teacher', 'student', 'parent']);
export const attendanceStatusEnum = pgEnum('attendance_status', ['present', 'absent', 'late', 'excused']);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Classes table
export const classesTable = pgTable('classes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  grade_level: integer('grade_level').notNull(), // 7, 8, 9 for SMP
  academic_year: text('academic_year').notNull(), // e.g., "2024/2025"
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Subjects table
export const subjectsTable = pgTable('subjects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Students table
export const studentsTable = pgTable('students', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  student_number: text('student_number').notNull().unique(),
  class_id: integer('class_id').notNull(),
  parent_id: integer('parent_id'), // nullable - parent might not be in system yet
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Teachers table
export const teachersTable = pgTable('teachers', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  employee_number: text('employee_number').notNull().unique(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Parents table
export const parentsTable = pgTable('parents', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  phone_number: text('phone_number').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Teacher assignments table (which teacher teaches which subject in which class)
export const teacherAssignmentsTable = pgTable('teacher_assignments', {
  id: serial('id').primaryKey(),
  teacher_id: integer('teacher_id').notNull(),
  subject_id: integer('subject_id').notNull(),
  class_id: integer('class_id').notNull(),
  academic_year: text('academic_year').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Attendances table
export const attendancesTable = pgTable('attendances', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull(),
  subject_id: integer('subject_id'), // nullable for daily attendance (not subject-specific)
  date: date('date').notNull(),
  status: attendanceStatusEnum('status').notNull(),
  notes: text('notes'), // nullable
  recorded_by: integer('recorded_by').notNull(), // teacher/admin who recorded
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Grades table
export const gradesTable = pgTable('grades', {
  id: serial('id').primaryKey(),
  student_id: integer('student_id').notNull(),
  subject_id: integer('subject_id').notNull(),
  assignment_type: text('assignment_type').notNull(), // 'daily', 'midterm', 'final'
  assignment_name: text('assignment_name').notNull(),
  score: numeric('score', { precision: 5, scale: 2 }).notNull(),
  max_score: numeric('max_score', { precision: 5, scale: 2 }).notNull(),
  weight: numeric('weight', { precision: 5, scale: 2 }).notNull(), // percentage weight
  date_recorded: date('date_recorded').notNull(),
  recorded_by: integer('recorded_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Grade configuration table (for weight settings per subject/class)
export const gradeConfigsTable = pgTable('grade_configs', {
  id: serial('id').primaryKey(),
  subject_id: integer('subject_id').notNull(),
  class_id: integer('class_id').notNull(),
  daily_weight: numeric('daily_weight', { precision: 5, scale: 2 }).notNull(), // percentage
  midterm_weight: numeric('midterm_weight', { precision: 5, scale: 2 }).notNull(), // percentage
  final_weight: numeric('final_weight', { precision: 5, scale: 2 }).notNull(), // percentage
  academic_year: text('academic_year').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  parent_id: integer('parent_id').notNull(),
  student_id: integer('student_id').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull(), // 'attendance', 'grade', 'general'
  status: notificationStatusEnum('status').notNull(),
  sent_at: timestamp('sent_at'), // nullable
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ one }) => ({
  student: one(studentsTable, {
    fields: [usersTable.id],
    references: [studentsTable.user_id]
  }),
  teacher: one(teachersTable, {
    fields: [usersTable.id],
    references: [teachersTable.user_id]
  }),
  parent: one(parentsTable, {
    fields: [usersTable.id],
    references: [parentsTable.user_id]
  })
}));

export const studentsRelations = relations(studentsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [studentsTable.user_id],
    references: [usersTable.id]
  }),
  class: one(classesTable, {
    fields: [studentsTable.class_id],
    references: [classesTable.id]
  }),
  parent: one(parentsTable, {
    fields: [studentsTable.parent_id],
    references: [parentsTable.id]
  }),
  attendances: many(attendancesTable),
  grades: many(gradesTable)
}));

export const teachersRelations = relations(teachersTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [teachersTable.user_id],
    references: [usersTable.id]
  }),
  assignments: many(teacherAssignmentsTable),
  attendances: many(attendancesTable),
  grades: many(gradesTable)
}));

export const parentsRelations = relations(parentsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [parentsTable.user_id],
    references: [usersTable.id]
  }),
  children: many(studentsTable),
  notifications: many(notificationsTable)
}));

export const classesRelations = relations(classesTable, ({ many }) => ({
  students: many(studentsTable),
  teacherAssignments: many(teacherAssignmentsTable),
  gradeConfigs: many(gradeConfigsTable)
}));

export const subjectsRelations = relations(subjectsTable, ({ many }) => ({
  teacherAssignments: many(teacherAssignmentsTable),
  attendances: many(attendancesTable),
  grades: many(gradesTable),
  gradeConfigs: many(gradeConfigsTable)
}));

export const teacherAssignmentsRelations = relations(teacherAssignmentsTable, ({ one }) => ({
  teacher: one(teachersTable, {
    fields: [teacherAssignmentsTable.teacher_id],
    references: [teachersTable.id]
  }),
  subject: one(subjectsTable, {
    fields: [teacherAssignmentsTable.subject_id],
    references: [subjectsTable.id]
  }),
  class: one(classesTable, {
    fields: [teacherAssignmentsTable.class_id],
    references: [classesTable.id]
  })
}));

export const attendancesRelations = relations(attendancesTable, ({ one }) => ({
  student: one(studentsTable, {
    fields: [attendancesTable.student_id],
    references: [studentsTable.id]
  }),
  subject: one(subjectsTable, {
    fields: [attendancesTable.subject_id],
    references: [subjectsTable.id]
  }),
  recordedBy: one(usersTable, {
    fields: [attendancesTable.recorded_by],
    references: [usersTable.id]
  })
}));

export const gradesRelations = relations(gradesTable, ({ one }) => ({
  student: one(studentsTable, {
    fields: [gradesTable.student_id],
    references: [studentsTable.id]
  }),
  subject: one(subjectsTable, {
    fields: [gradesTable.subject_id],
    references: [subjectsTable.id]
  }),
  recordedBy: one(usersTable, {
    fields: [gradesTable.recorded_by],
    references: [usersTable.id]
  })
}));

export const gradeConfigsRelations = relations(gradeConfigsTable, ({ one }) => ({
  subject: one(subjectsTable, {
    fields: [gradeConfigsTable.subject_id],
    references: [subjectsTable.id]
  }),
  class: one(classesTable, {
    fields: [gradeConfigsTable.class_id],
    references: [classesTable.id]
  })
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  parent: one(parentsTable, {
    fields: [notificationsTable.parent_id],
    references: [parentsTable.id]
  }),
  student: one(studentsTable, {
    fields: [notificationsTable.student_id],
    references: [studentsTable.id]
  })
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Class = typeof classesTable.$inferSelect;
export type NewClass = typeof classesTable.$inferInsert;

export type Subject = typeof subjectsTable.$inferSelect;
export type NewSubject = typeof subjectsTable.$inferInsert;

export type Student = typeof studentsTable.$inferSelect;
export type NewStudent = typeof studentsTable.$inferInsert;

export type Teacher = typeof teachersTable.$inferSelect;
export type NewTeacher = typeof teachersTable.$inferInsert;

export type Parent = typeof parentsTable.$inferSelect;
export type NewParent = typeof parentsTable.$inferInsert;

export type TeacherAssignment = typeof teacherAssignmentsTable.$inferSelect;
export type NewTeacherAssignment = typeof teacherAssignmentsTable.$inferInsert;

export type Attendance = typeof attendancesTable.$inferSelect;
export type NewAttendance = typeof attendancesTable.$inferInsert;

export type Grade = typeof gradesTable.$inferSelect;
export type NewGrade = typeof gradesTable.$inferInsert;

export type GradeConfig = typeof gradeConfigsTable.$inferSelect;
export type NewGradeConfig = typeof gradeConfigsTable.$inferInsert;

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  classes: classesTable,
  subjects: subjectsTable,
  students: studentsTable,
  teachers: teachersTable,
  parents: parentsTable,
  teacherAssignments: teacherAssignmentsTable,
  attendances: attendancesTable,
  grades: gradesTable,
  gradeConfigs: gradeConfigsTable,
  notifications: notificationsTable
};