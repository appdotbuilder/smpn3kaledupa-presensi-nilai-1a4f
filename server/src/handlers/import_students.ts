import { db } from '../db';
import { usersTable, studentsTable, parentsTable, classesTable } from '../db/schema';
import { type ImportStudentsInput, type Student } from '../schema';
import { eq } from 'drizzle-orm';

export const importStudents = async (input: ImportStudentsInput): Promise<Student[]> => {
  try {
    // Verify class exists
    const classExists = await db.select()
      .from(classesTable)
      .where(eq(classesTable.id, input.class_id))
      .execute();

    if (classExists.length === 0) {
      throw new Error(`Class with ID ${input.class_id} does not exist`);
    }

    const importedStudents: Student[] = [];

    // Process each student sequentially to handle errors properly
    for (const studentData of input.students) {
      try {
        // Check if student number already exists
        const existingStudent = await db.select()
          .from(studentsTable)
          .where(eq(studentsTable.student_number, studentData.student_number))
          .execute();

        if (existingStudent.length > 0) {
          throw new Error(`Student with number ${studentData.student_number} already exists`);
        }

        // Check if user email already exists
        const existingUser = await db.select()
          .from(usersTable)
          .where(eq(usersTable.email, studentData.email))
          .execute();

        if (existingUser.length > 0) {
          throw new Error(`User with email ${studentData.email} already exists`);
        }

        let parentId: number | null = null;

        // Create parent if data provided
        if (studentData.parent_name && studentData.parent_email && studentData.parent_phone) {
          // Check if parent email already exists
          const existingParentUser = await db.select()
            .from(usersTable)
            .where(eq(usersTable.email, studentData.parent_email))
            .execute();

          if (existingParentUser.length === 0) {
            // Create parent user account
            const parentUserResult = await db.insert(usersTable)
              .values({
                email: studentData.parent_email,
                password: 'temp123', // Default password - should be changed on first login
                name: studentData.parent_name,
                role: 'parent'
              })
              .returning()
              .execute();

            // Create parent record
            const parentResult = await db.insert(parentsTable)
              .values({
                user_id: parentUserResult[0].id,
                phone_number: studentData.parent_phone
              })
              .returning()
              .execute();

            parentId = parentResult[0].id;
          } else {
            // Find existing parent record
            const existingParent = await db.select()
              .from(parentsTable)
              .where(eq(parentsTable.user_id, existingParentUser[0].id))
              .execute();

            if (existingParent.length > 0) {
              parentId = existingParent[0].id;
            }
          }
        }

        // Create student user account
        const studentUserResult = await db.insert(usersTable)
          .values({
            email: studentData.email,
            password: 'temp123', // Default password - should be changed on first login
            name: studentData.name,
            role: 'student'
          })
          .returning()
          .execute();

        // Create student record
        const studentResult = await db.insert(studentsTable)
          .values({
            user_id: studentUserResult[0].id,
            student_number: studentData.student_number,
            class_id: input.class_id,
            parent_id: parentId
          })
          .returning()
          .execute();

        importedStudents.push(studentResult[0]);

      } catch (error) {
        console.error(`Failed to import student ${studentData.name}:`, error);
        throw new Error(`Failed to import student ${studentData.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return importedStudents;
  } catch (error) {
    console.error('Student import failed:', error);
    throw error;
  }
};