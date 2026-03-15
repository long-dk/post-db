# @long-dk/post-db

[![Release](https://github.com/long-dk/post-db/actions/workflows/release.yml/badge.svg)](https://github.com/long-dk/post-db/actions/workflows/release.yml)
[![npm](https://img.shields.io/badge/npm-GitHub%20Packages-blue)](https://github.com/long-dk/post-db/packages)

ORM-agnostic database package for the post domain. Exposes a repository interface (`IPostRepository`) backed by Prisma internally. Apps and workers import only the interface — never `PrismaClient` directly — so the underlying ORM can be swapped without touching any service.

## Schema

```prisma
model Post {
  id        String    @id @default(uuid())
  title     String
  content   String
  images    String[]
  createdBy String    @map("created_by") @db.Uuid
  updatedBy String?   @map("updated_by") @db.Uuid
  deletedBy String?   @map("deleted_by") @db.Uuid
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?
  isDeleted Boolean   @default(false)
}
```

`createdBy`, `updatedBy`, `deletedBy` store user UUIDs. The actual user data is fetched from `auth-service` by `post-service`'s `PostMappingService`.

## Installation

```bash
# Requires GitHub Packages auth — ensure ~/.npmrc contains:
# @long-dk:registry=https://npm.pkg.github.com
# //npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT

npm install @long-dk/post-db
```

## Usage

```typescript
import { createPostDbManager, IPostDbManager, IPostRepository } from '@long-dk/post-db';

// In your NestJS module
const dbManager: IPostDbManager = createPostDbManager(process.env.DATABASE_URL);
const postRepository: IPostRepository = dbManager.postRepository;

// Use the repository
const post = await postRepository.findById('uuid-here');
const posts = await postRepository.findMany({ page: 1, limit: 10, search: 'nestjs' });
```

## Public API

```typescript
// Factory
createPostDbManager(databaseUrl: string): IPostDbManager
resetPostDbManager(): void

// Interfaces (type-only imports)
IPostDbManager
IPostRepository
CreatePostInput
UpdatePostInput
Post
PaginatedResult<T>
QueryOptions
```

## Repository Interface

`IPostRepository` extends base operations:

| Method | Description |
|---|---|
| `findById(id)` | Find post by UUID |
| `findOne(filter)` | Find single post by filter |
| `findMany(options)` | Paginated post list with search/filter |
| `create(input)` | Create new post |
| `update(id, input)` | Update post fields |
| `softDelete(id, deletedBy)` | Set `deletedAt` and `isDeleted = true` |

All `findMany` queries automatically filter `deletedAt: null` and `isDeleted: false`.

## Database Migrations

Migrations are owned by this package. **Never add a `schema.prisma` in your app.**

```bash
npm run prisma:migrate     # prisma migrate dev
npm run prisma:generate    # regenerate Prisma client
npm run prisma:studio      # open Prisma Studio
```

## Versioning

| Change | Version bump |
|---|---|
| Schema change | Minor |
| Breaking interface change | Major |
| Bug fix / non-breaking | Patch |

Apps and their paired worker must always pin to the **same version range**.

## Publishing

Releases are triggered via `workflow_dispatch` on the GitHub Actions release workflow. The package is published to GitHub Packages under `@long-dk`.

## Scripts

```bash
npm run build            # tsc → dist/
npm run lint             # ESLint --fix
npm run format           # Prettier --write
npm test                 # Unit tests (100% coverage enforced)
npm run version:patch    # Bump patch version
npm run version:minor    # Bump minor version
npm run version:major    # Bump major version
```

## License

[MIT](LICENSE)
