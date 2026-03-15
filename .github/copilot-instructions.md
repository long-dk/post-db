# Copilot Instructions – @long-dk/post-db

## Overview

Shared npm package published to **GitHub Packages** (`@long-dk/post-db`). Owns the **Post Prisma schema**, all database migrations, and exposes an **ORM-agnostic repository interface** so `post-service` and `post-worker` never import `PrismaClient` directly.

Both `post-service` and `post-worker` must always pin to the **same version range** of this package.

## Versioning Rules

| Change type                          | Version bump |
| ------------------------------------ | ------------ |
| Schema change (new field, new model) | **minor**    |
| Breaking interface change            | **major**    |
| Internal Prisma query fix            | **patch**    |

## Developer Workflows

Run all commands from the `packages/post-db/` directory:

```bash
npm run prisma:migrate   # dotenv -e .env -- prisma migrate dev
npm run prisma:generate  # regenerates Prisma client from schema
npm run prisma:studio    # opens Prisma Studio against the post DB
npm run build            # tsc compile → dist/ (run before publishing)
npm publish              # publishes to GitHub Packages (requires GITHUB_TOKEN)
```

## ORM-Agnostic Design

The package exposes interfaces, not Prisma types. Apps interact only with the public API:

```typescript
import { createPostDbManager, IPostDbManager, IPostRepository } from "@long-dk/post-db";

// Wire up once at module init (NestJS provider factory)
const dbManager: IPostDbManager = createPostDbManager(process.env.DATABASE_URL);

// Inject IPostRepository in services — never PrismaClient
const post = await dbManager.postRepository.findById(postId);
```

### Swapping the ORM

To replace Prisma with TypeORM or Drizzle:

1. Replace `src/client/prisma.client.ts` with the new client factory
2. Replace `src/repositories/post.repository.ts` with a new implementation of `IPostRepository`
3. **Do not touch** `src/interfaces/` or `src/index.ts` — the contract stays the same
4. Run `npm run build` and bump the package version

## Schema Ownership

`prisma/schema.prisma` is the **single source of truth** for the post database. No app or worker has its own `schema.prisma`.

Current schema covers:

- `Post` — id (UUID), title, content, images (String[]), createdBy (UUID — references User in auth DB), deletedAt?, isDeleted (Boolean), createdAt, updatedAt

Note: `createdBy` is a plain UUID — there is **no foreign key** to the auth DB. Author enrichment happens at the service layer via `GrpcAuthService.getUserById()`.

### Running a migration

```bash
# From packages/post-db/
npm run prisma:migrate   # prompts for migration name, applies to dev DB
```

Always bump the package **minor version** after a schema change and update both `post-service` and `post-worker` to the new version.

## Public API (`src/index.ts`)

```typescript
export { IPostDbManager } from "./interfaces/db-manager.interface";
export { IPostRepository } from "./interfaces/post.repository.interface";
export { createPostDbManager } from "./client/prisma.client";
```

Never export `PrismaClient`, raw Prisma types, or implementation details.

## Folder Structure

```
packages/post-db/
  prisma/
    schema.prisma               # Post — source of truth for post DB
    migrations/                 # All post DB migrations — never edit manually
  src/
    client/
      prisma.client.ts          # PrismaClient singleton + createPostDbManager() factory
    interfaces/
      post.repository.interface.ts  # IPostRepository — ORM-agnostic CRUD contract
      db-manager.interface.ts       # IPostDbManager { postRepository: IPostRepository }
    repositories/
      post.repository.ts        # Concrete Prisma implementation of IPostRepository
    operations/
      base.operations.ts        # Generic helpers: findById, findOne, findMany,
                                #   create, update, softDelete (sets deletedAt + isDeleted)
    index.ts                    # Public API — ONLY thing consumers should import from
  package.json                  # name: "@long-dk/post-db", "main": "dist/index.js"
  tsconfig.json                 # Compiles src/ → dist/
```

## IPostRepository Interface Contract

```typescript
interface IPostRepository {
  findById(id: string): Promise<Post | null>;
  findOne(filter: Partial<Post>): Promise<Post | null>;
  findMany(options: QueryOptions): Promise<PaginatedResult<Post>>;
  create(data: CreatePostInput): Promise<Post>;
  update(id: string, data: Partial<Post>): Promise<Post>;
  softDelete(id: string): Promise<Post>; // sets deletedAt + isDeleted: true
  softDeleteMany(ids: string[]): Promise<number>; // bulk soft-delete, returns count
}
```

All methods treat `deletedAt: null` as the baseline — soft-deleted posts are never returned unless explicitly queried.

## Testing Conventions

- Unit tests in `test/unit/` with 100% coverage on `*.repository.ts` and `*.operations.ts`
- Mock `PrismaClient` at the method level: `prisma.post.findUnique = jest.fn()`
- Integration tests (if any) run against a real Docker Postgres — never the production DB
