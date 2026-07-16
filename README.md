# @mmtq/hono-swagger

A zero-runtime-overhead, statically analyzed OpenAPI 3 generator for Hono and Zod.

Stop manually maintaining duplicate OpenAPI metadata! `@mmtq/hono-swagger` is a CLI tool that parses your TypeScript AST at build-time to automatically generate a complete OpenAPI 3.x specification and Swagger UI from your existing Hono routes and Zod schemas.

## Features

- 🚀 **Zero Runtime Overhead**: The documentation generation happens entirely at build-time. Your production Hono application isn't bloated with reflection or metadata-generation logic.
- 🧘 **Single Source of Truth**: Your actual Hono routes, Zod schemas, and JSDoc comments are the only source of truth. No need to wrap your routes in `describeRoute()` objects.
- 🛡️ **Type-Safe Responses**: The lightweight `typed()` helper guarantees that your route handlers actually return the data shape declared in your Zod schemas.
- 🎨 **Built-in Swagger UI**: Effortlessly serve the beautiful Swagger UI directly from your Hono app using our zero-dependency middleware.

## Installation

```bash
npm install @mmtq/hono-swagger
```

*(Note: Ensure that `hono` and `zod` are installed in your project as well)*

## Quick Start

### 1. Configure the Generator

Create an `openapi.config.ts` file in the root of your project:

```typescript
export default {
  info: {
    title: 'My Hono API',
    version: '1.0.0',
    description: 'Documentation generated at build-time!'
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local Server' }
  ],
  include: ['src/**/*.ts'], // Where your Hono routes live
  outputDir: 'docs', // Where the generated openapi.json and static UI will be saved
  formats: ['json']
};
```

### 2. Write Your Routes

Write your Hono routes like normal, using `@hono/zod-validator`.

To strongly type your API responses, wrap your JSON responses in the `typed()` helper from `@mmtq/hono-swagger/helpers`. You can also use standard JSDoc comments to enrich your documentation!

```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { typed } from '@mmtq/hono-swagger/helpers';

const app = new Hono();

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  age: z.number().int().min(0)
});

/**
 * @summary Get a user by ID
 * @description Fetches a user securely from the database.
 * @tags Users
 */
app.get('/users/:id', zValidator('param', z.object({ id: z.string() })), (c) => {
  const { id } = c.req.valid('param');
  
  // typed() ensures your response matches UserSchema!
  return typed(c, UserSchema, { id, name: 'Alice', age: 30 }); 
});
```

#### Supported JSDoc Tags
- `@summary <text>`
- `@description <text>`
- `@tags <comma, separated, tags>`
- `@deprecated`
- `@openapi-ignore` (Hides the route from the generated documentation)

### 3. Serve the Swagger UI

You can serve the generated Swagger UI directly from your Hono application using the included zero-dependency `swaggerUI` middleware:

```typescript
import { swaggerUI } from '@mmtq/hono-swagger/helpers';
import * as fs from 'fs/promises';

// 1. Serve the generated OpenAPI JSON
app.get('/docs/openapi.json', async (c) => {
  const spec = await fs.readFile('./docs/openapi.json', 'utf-8');
  return c.json(JSON.parse(spec));
});

// 2. Serve the Swagger UI!
/** @openapi-ignore */
app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }));
```

### 4. Generate the Docs!

Run the CLI tool to statically analyze your code and generate the `docs/openapi.json` file:

```bash
npx hono-swagger generate
```

Now start your Hono app, navigate to `/docs`, and enjoy your fully typed OpenAPI documentation!

## CLI Reference

`@mmtq/hono-swagger` comes with several handy CLI commands:

- **`npx hono-swagger generate`**
  Scans your codebase and outputs the OpenAPI spec according to your config.
  
- **`npx hono-swagger watch`**
  Runs in the background, watching your TypeScript files for changes and automatically regenerating the docs. Perfect for local development!
  
- **`npx hono-swagger validate`**
  Checks your generated OpenAPI spec against the official OpenAPI 3 schema to ensure it is perfectly valid.
  
- **`npx hono-swagger serve --port 8080`**
  Spins up a lightweight static HTTP server specifically for hosting the generated Swagger UI (useful if you don't want to serve it directly through your Hono app).
  
- **`npx hono-swagger clean`**
  Deletes the generated `outputDir` to ensure a fresh build.
