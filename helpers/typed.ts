import type { Context } from "hono"
import type { z } from "zod"

export const typed = <T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
  data: z.infer<T>,
  status: number = 200
) => c.json(data, status as any)

export const apiResponse = <T extends z.ZodTypeAny>(data: T) =>
  ({ status: 'ok' as const, message: 'Success', data })

export const paginatedApiResponse = <T extends z.ZodTypeAny>(data: T[]) =>
  ({
    status: 'ok' as const,
    data,
    pagination: {
      page: 1,
      limit: 10,
      total: data.length,
      totalPages: 1
    }
  })
