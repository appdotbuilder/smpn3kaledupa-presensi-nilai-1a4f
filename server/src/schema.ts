import { z } from 'zod';

// Enums
export const userRoleSchema = z.enum(['admin', 'teacher', 'student', 'parent']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'excused']);
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>;

export const notificationStatusSchema = z.enum(['pending', 'sent', 'failed']);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password: z.string(),
  name: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Class schema
export const classSchema = z.object({
  id: z.number(),
  name: z.string(),
  grade_level: z.number().int(),
  academic_year: z.string(),
  created_at: z.coerce.date()
});

export type Class = z.infer<typeof classSchema>;

// Subject schema
export const subjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  created_at: z.coerce.date()
});

export type Subject = z.infer<typeof subjectSchema>;

// Student schema
export const studentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  student_number: z.string(),
  class_id: z.number(),
  parent_id: z.number().nullable(),
  created_at: z.coerce.date()
});

export type Student = z.infer<typeof studentSchema>;

// Teacher schema
export const teacherSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  employee_number: z.string(),
  created_at: z.coerce.date()
});

export type Teacher = z.infer<typeof teacherSchema>;

// Parent schema
export const parentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  phone_number: z.string(),
  created_at: z.coerce.date()
});

export type Parent = z.infer<typeof parentSchema>;

// Teacher-Subject-Class assignment schema
export const teacherAssignmentSchema = z.object({
  id: z.number(),
  teacher_id: z.number(),
  subject_id: z.number(),
  class_id: z.number(),
  academic_year: z.string(),
  created_at: z.coerce.date()
});

export type TeacherAssignment = z.infer<typeof teacherAssignmentSchema>;

// Attendance schema
export const attendanceSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  subject_id: z.number().nullable(),
  date: z.coerce.date(),
  status: attendanceStatusSchema,
  notes: z.string().nullable(),
  recorded_by: z.number(),
  created_at: z.coerce.date()
});

export type Attendance = z.infer<typeof attendanceSchema>;

// Grade schema
export const gradeSchema = z.object({
  id: z.number(),
  student_id: z.number(),
  subject_id: z.number(),
  assignment_type: z.string(), // 'daily', 'midterm', 'final'
  assignment_name: z.string(),
  score: z.number(),
  max_score: z.number(),
  weight: z.number(), // percentage weight for final grade calculation
  date_recorded: z.coerce.date(),
  recorded_by: z.number(),
  created_at: z.coerce.date()
});

export type Grade = z.infer<typeof gradeSchema>;

// Grade configuration schema (for weight settings)
export const gradeConfigSchema = z.object({
  id: z.number(),
  subject_id: z.number(),
  class_id: z.number(),
  daily_weight: z.number(), // percentage
  midterm_weight: z.number(), // percentage
  final_weight: z.number(), // percentage
  academic_year: z.string(),
  created_at: z.coerce.date()
});

export type GradeConfig = z.infer<typeof gradeConfigSchema>;

// Notification schema
export const notificationSchema = z.object({
  id: z.number(),
  parent_id: z.number(),
  student_id: z.number(),
  message: z.string(),
  type: z.string(), // 'attendance', 'grade', 'general'
  status: notificationStatusSchema,
  sent_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type Notification = z.infer<typeof notificationSchema>;

// Input schemas for creating/updating records

// User input schemas
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: userRoleSchema.optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Class input schemas
export const createClassInputSchema = z.object({
  name: z.string().min(1),
  grade_level: z.number().int().min(7).max(9), // SMP grades 7-9
  academic_year: z.string()
});

export type CreateClassInput = z.infer<typeof createClassInputSchema>;

// Subject input schemas
export const createSubjectInputSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1)
});

export type CreateSubjectInput = z.infer<typeof createSubjectInputSchema>;

// Student input schemas
export const createStudentInputSchema = z.object({
  user_id: z.number(),
  student_number: z.string().min(1),
  class_id: z.number(),
  parent_id: z.number().nullable()
});

export type CreateStudentInput = z.infer<typeof createStudentInputSchema>;

// Teacher input schemas
export const createTeacherInputSchema = z.object({
  user_id: z.number(),
  employee_number: z.string().min(1)
});

export type CreateTeacherInput = z.infer<typeof createTeacherInputSchema>;

// Parent input schemas
export const createParentInputSchema = z.object({
  user_id: z.number(),
  phone_number: z.string().min(1)
});

export type CreateParentInput = z.infer<typeof createParentInputSchema>;

// Teacher assignment input schemas
export const createTeacherAssignmentInputSchema = z.object({
  teacher_id: z.number(),
  subject_id: z.number(),
  class_id: z.number(),
  academic_year: z.string()
});

export type CreateTeacherAssignmentInput = z.infer<typeof createTeacherAssignmentInputSchema>;

// Attendance input schemas
export const createAttendanceInputSchema = z.object({
  student_id: z.number(),
  subject_id: z.number().nullable(),
  date: z.coerce.date(),
  status: attendanceStatusSchema,
  notes: z.string().nullable(),
  recorded_by: z.number()
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceInputSchema>;

export const bulkAttendanceInputSchema = z.object({
  attendances: z.array(createAttendanceInputSchema),
  date: z.coerce.date(),
  subject_id: z.number().nullable(),
  recorded_by: z.number()
});

export type BulkAttendanceInput = z.infer<typeof bulkAttendanceInputSchema>;

// Grade input schemas
export const createGradeInputSchema = z.object({
  student_id: z.number(),
  subject_id: z.number(),
  assignment_type: z.string(),
  assignment_name: z.string().min(1),
  score: z.number().min(0),
  max_score: z.number().positive(),
  weight: z.number().min(0).max(100),
  date_recorded: z.coerce.date(),
  recorded_by: z.number()
});

export type CreateGradeInput = z.infer<typeof createGradeInputSchema>;

export const bulkGradeInputSchema = z.object({
  grades: z.array(createGradeInputSchema)
});

export type BulkGradeInput = z.infer<typeof bulkGradeInputSchema>;

// Grade configuration input schemas
export const createGradeConfigInputSchema = z.object({
  subject_id: z.number(),
  class_id: z.number(),
  daily_weight: z.number().min(0).max(100),
  midterm_weight: z.number().min(0).max(100),
  final_weight: z.number().min(0).max(100),
  academic_year: z.string()
});

export type CreateGradeConfigInput = z.infer<typeof createGradeConfigInputSchema>;

// Notification input schemas
export const createNotificationInputSchema = z.object({
  parent_id: z.number(),
  student_id: z.number(),
  message: z.string().min(1),
  type: z.string()
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

// Query input schemas
export const attendanceReportInputSchema = z.object({
  class_id: z.number().optional(),
  student_id: z.number().optional(),
  subject_id: z.number().optional(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date()
});

export type AttendanceReportInput = z.infer<typeof attendanceReportInputSchema>;

export const gradeReportInputSchema = z.object({
  class_id: z.number().optional(),
  student_id: z.number().optional(),
  subject_id: z.number().optional(),
  academic_year: z.string()
});

export type GradeReportInput = z.infer<typeof gradeReportInputSchema>;

export const studentReportInputSchema = z.object({
  student_id: z.number(),
  academic_year: z.string()
});

export type StudentReportInput = z.infer<typeof studentReportInputSchema>;

// Excel import schema
export const importStudentsInputSchema = z.object({
  class_id: z.number(),
  students: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    student_number: z.string().min(1),
    parent_name: z.string().optional(),
    parent_email: z.string().email().optional(),
    parent_phone: z.string().optional()
  }))
});

export type ImportStudentsInput = z.infer<typeof importStudentsInputSchema>;