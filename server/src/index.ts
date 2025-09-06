import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  createClassInputSchema,
  createSubjectInputSchema,
  createStudentInputSchema,
  createTeacherInputSchema,
  createParentInputSchema,
  createTeacherAssignmentInputSchema,
  createAttendanceInputSchema,
  bulkAttendanceInputSchema,
  createGradeInputSchema,
  bulkGradeInputSchema,
  createGradeConfigInputSchema,
  createNotificationInputSchema,
  attendanceReportInputSchema,
  gradeReportInputSchema,
  studentReportInputSchema,
  importStudentsInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { getUsers } from './handlers/get_users';
import { createClass } from './handlers/create_class';
import { getClasses } from './handlers/get_classes';
import { createSubject } from './handlers/create_subject';
import { getSubjects } from './handlers/get_subjects';
import { createStudent } from './handlers/create_student';
import { getStudents } from './handlers/get_students';
import { createTeacher } from './handlers/create_teacher';
import { getTeachers } from './handlers/get_teachers';
import { createParent } from './handlers/create_parent';
import { createTeacherAssignment } from './handlers/create_teacher_assignment';
import { createAttendance } from './handlers/create_attendance';
import { bulkCreateAttendance } from './handlers/bulk_create_attendance';
import { getAttendanceReport } from './handlers/get_attendance_report';
import { createGrade } from './handlers/create_grade';
import { bulkCreateGrades } from './handlers/bulk_create_grades';
import { createGradeConfig } from './handlers/create_grade_config';
import { getGradeReport } from './handlers/get_grade_report';
import { getStudentReport } from './handlers/get_student_report';
import { importStudents } from './handlers/import_students';
import { createNotification } from './handlers/create_notification';
import { getNotifications } from './handlers/get_notifications';
import { exportGrades, type ExportGradesInput } from './handlers/export_grades';
import { exportAttendance, type ExportAttendanceInput } from './handlers/export_attendance';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  getUsers: publicProcedure
    .query(() => getUsers()),

  // Class management
  createClass: publicProcedure
    .input(createClassInputSchema)
    .mutation(({ input }) => createClass(input)),
  getClasses: publicProcedure
    .query(() => getClasses()),

  // Subject management
  createSubject: publicProcedure
    .input(createSubjectInputSchema)
    .mutation(({ input }) => createSubject(input)),
  getSubjects: publicProcedure
    .query(() => getSubjects()),

  // Student management
  createStudent: publicProcedure
    .input(createStudentInputSchema)
    .mutation(({ input }) => createStudent(input)),
  getStudents: publicProcedure
    .query(() => getStudents()),
  importStudents: publicProcedure
    .input(importStudentsInputSchema)
    .mutation(({ input }) => importStudents(input)),

  // Teacher management
  createTeacher: publicProcedure
    .input(createTeacherInputSchema)
    .mutation(({ input }) => createTeacher(input)),
  getTeachers: publicProcedure
    .query(() => getTeachers()),

  // Parent management
  createParent: publicProcedure
    .input(createParentInputSchema)
    .mutation(({ input }) => createParent(input)),

  // Teacher assignment management
  createTeacherAssignment: publicProcedure
    .input(createTeacherAssignmentInputSchema)
    .mutation(({ input }) => createTeacherAssignment(input)),

  // Attendance management
  createAttendance: publicProcedure
    .input(createAttendanceInputSchema)
    .mutation(({ input }) => createAttendance(input)),
  bulkCreateAttendance: publicProcedure
    .input(bulkAttendanceInputSchema)
    .mutation(({ input }) => bulkCreateAttendance(input)),
  getAttendanceReport: publicProcedure
    .input(attendanceReportInputSchema)
    .query(({ input }) => getAttendanceReport(input)),
  exportAttendance: publicProcedure
    .input(z.object({
      class_id: z.number().optional(),
      student_id: z.number().optional(),
      subject_id: z.number().optional(),
      start_date: z.coerce.date(),
      end_date: z.coerce.date(),
      format: z.enum(['excel', 'pdf'])
    }) as z.ZodType<ExportAttendanceInput>)
    .mutation(({ input }) => exportAttendance(input)),

  // Grade management
  createGrade: publicProcedure
    .input(createGradeInputSchema)
    .mutation(({ input }) => createGrade(input)),
  bulkCreateGrades: publicProcedure
    .input(bulkGradeInputSchema)
    .mutation(({ input }) => bulkCreateGrades(input)),
  createGradeConfig: publicProcedure
    .input(createGradeConfigInputSchema)
    .mutation(({ input }) => createGradeConfig(input)),
  getGradeReport: publicProcedure
    .input(gradeReportInputSchema)
    .query(({ input }) => getGradeReport(input)),
  exportGrades: publicProcedure
    .input(z.object({
      class_id: z.number().optional(),
      student_id: z.number().optional(),
      subject_id: z.number().optional(),
      academic_year: z.string(),
      format: z.enum(['excel', 'pdf'])
    }) as z.ZodType<ExportGradesInput>)
    .mutation(({ input }) => exportGrades(input)),

  // Student report
  getStudentReport: publicProcedure
    .input(studentReportInputSchema)
    .query(({ input }) => getStudentReport(input)),

  // Notification management
  createNotification: publicProcedure
    .input(createNotificationInputSchema)
    .mutation(({ input }) => createNotification(input)),
  getNotifications: publicProcedure
    .input(z.object({ parentId: z.number().optional() }))
    .query(({ input }) => getNotifications(input.parentId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
  console.log('Available endpoints:');
  console.log('- User Management: createUser, getUsers');
  console.log('- Class Management: createClass, getClasses');
  console.log('- Subject Management: createSubject, getSubjects');
  console.log('- Student Management: createStudent, getStudents, importStudents');
  console.log('- Teacher Management: createTeacher, getTeachers');
  console.log('- Parent Management: createParent');
  console.log('- Teacher Assignment: createTeacherAssignment');
  console.log('- Attendance: createAttendance, bulkCreateAttendance, getAttendanceReport, exportAttendance');
  console.log('- Grades: createGrade, bulkCreateGrades, createGradeConfig, getGradeReport, exportGrades');
  console.log('- Reports: getStudentReport');
  console.log('- Notifications: createNotification, getNotifications');
}

start();