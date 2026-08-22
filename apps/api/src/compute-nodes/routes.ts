import { createRoute, z } from '@hono/zod-openapi'
import { makeOpenApiApp, errors, json } from '../openapi'
import type { AppEnv } from '../types'
import { consumeNodeEnrollmentToken } from '../repositories/compute-node-credentials'

export const computeNodePublicApp = makeOpenApiApp<AppEnv>()

computeNodePublicApp.openapi(
  createRoute({
    method: 'post',
    path: '/enroll',
    tags: ['compute-nodes'],
    summary: 'Exchange a single-use enrollment token for one node credential',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({ enrollment_token: z.string().min(1) }),
          },
        },
      },
    },
    responses: {
      200: json(z.object({
        compute_node_id: z.string(),
        credential: z.string(),
        generation: z.number(),
      }), 'Node credential returned once'),
      ...errors(400, 401),
    },
  }),
  async (c: any) => {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body.enrollment_token !== 'string') {
      return c.json({ error: 'enrollment_token is required' }, 400)
    }
    const result = await consumeNodeEnrollmentToken(body.enrollment_token)
    if (!result) return c.json({ error: 'Enrollment token is invalid, expired, or consumed' }, 401)
    c.header('Cache-Control', 'no-store')
    return c.json({
      compute_node_id: result.nodeId,
      credential: result.credential,
      generation: result.generation,
    }, 200)
  },
)
