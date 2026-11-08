const { z } = require('zod');

// Middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validate req.body against the provided schema
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Return 400 Bad Request with details
        return res.status(400).json({
          error: 'Validation failed',
          issues: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
        });
      }
      next(err);
    }
  };
};

// ── Zod Schemas ───────────────────────────────────────────────────────────────

const agentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')),
  role_id: z.string().or(z.number()).optional().nullable().transform(v => (v ? Number(v) : null))
});

const agentUpdateSchema = z.object({
  role_id: z.string().or(z.number()).optional().nullable().transform(v => (v ? Number(v) : null))
});

const roleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters").max(50),
  permissions: z.array(z.string())
});

const quickReplySchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  body: z.string().min(1, "Body is required").max(1000)
});

const scheduledPostSchema = z.object({
  platform: z.enum(['facebook', 'instagram']),
  text: z.string().optional().nullable(),
  mediaUrl: z.string().url("Must be a valid URL").optional().nullable(),
  postType: z.enum(['feed', 'story', 'reel']),
  scheduledAt: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" })
});

module.exports = {
  validate,
  schemas: {
    agentSchema,
    agentUpdateSchema,
    roleSchema,
    quickReplySchema,
    scheduledPostSchema
  }
};
