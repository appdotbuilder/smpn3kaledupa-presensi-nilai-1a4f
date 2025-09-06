import { type CreateSubjectInput, type Subject } from '../schema';

export const createSubject = async (input: CreateSubjectInput): Promise<Subject> => {
  // This is a placeholder declaration! Real code should be implemented here.
  // The goal of this handler is creating a new subject/mata pelajaran
  // and persisting it in the database.
  return Promise.resolve({
    id: 0, // Placeholder ID
    name: input.name,
    code: input.code,
    created_at: new Date()
  } as Subject);
};