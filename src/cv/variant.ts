import { z } from 'zod'

export const VariantName = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(40, 'Use 40 characters or fewer.')
  .regex(/^[A-Za-z0-9 -]+$/, 'Use only letters, digits, spaces, and hyphens.')
