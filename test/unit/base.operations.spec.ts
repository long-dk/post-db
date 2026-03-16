import {
  findById,
  findOne,
  findMany,
  createRecord,
  updateRecord,
  softDelete,
  softDeleteMany,
  countRecords,
} from "../../src/operations/base.operations";
import { PrismaClient } from "../../generated/prisma/client";

function makeAccessor(overrides: Record<string, jest.Mock> = {}) {
  return {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    ...overrides,
  };
}

function makeClient(accessor: ReturnType<typeof makeAccessor>) {
  return { post: accessor } as unknown as PrismaClient;
}

describe("findById", () => {
  it("calls findFirst with id, deletedAt and isDeleted filters", async () => {
    const acc = makeAccessor({ findFirst: jest.fn().mockResolvedValue({ id: "1" }) });
    const result = await findById(makeClient(acc), "post", "1");
    expect(acc.findFirst).toHaveBeenCalledWith({
      where: { id: "1", deletedAt: null, isDeleted: false },
    });
    expect(result).toEqual({ id: "1" });
  });

  it("returns null when not found", async () => {
    const acc = makeAccessor({ findFirst: jest.fn().mockResolvedValue(null) });
    expect(await findById(makeClient(acc), "post", "999")).toBeNull();
  });
});

describe("findOne", () => {
  it("merges filter with soft-delete guards", async () => {
    const acc = makeAccessor({ findFirst: jest.fn().mockResolvedValue(null) });
    await findOne(makeClient(acc), "post", { title: "Hello" });
    expect(acc.findFirst).toHaveBeenCalledWith({
      where: { title: "Hello", deletedAt: null, isDeleted: false },
    });
  });
});

describe("findMany", () => {
  it("paginates with defaults", async () => {
    const items = [{ id: "1" }];
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue(items),
      count: jest.fn().mockResolvedValue(1),
    });
    const result = await findMany(makeClient(acc), "post", {});
    expect(result.items).toEqual(items);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(10);
    expect(result.meta.total).toBe(1);
  });

  it("applies search filter", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    });
    await findMany(makeClient(acc), "post", { search: "foo", searchFields: ["title"] });
    const where = acc.findMany.mock.calls[0][0].where;
    expect(where["OR"]).toEqual([{ title: { contains: "foo", mode: "insensitive" } }]);
  });

  it("skips OR when no search term", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    });
    await findMany(makeClient(acc), "post", { searchFields: ["title"] });
    expect(acc.findMany.mock.calls[0][0].where["OR"]).toBeUndefined();
  });

  it("caps limit at 100", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    });
    await findMany(makeClient(acc), "post", { limit: 500 });
    expect(acc.findMany.mock.calls[0][0].take).toBe(100);
  });

  it("includes relations", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    });
    await findMany(makeClient(acc), "post", { relations: ["author"] });
    expect(acc.findMany.mock.calls[0][0].include).toEqual({ author: true });
  });

  it("handles nested dot relations", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    });
    await findMany(makeClient(acc), "post", { relations: ["author.profile"] });
    expect(acc.findMany.mock.calls[0][0].include).toEqual({
      author: { include: { profile: true } },
    });
  });

  it("totalPages is 1 when count is 0", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    });
    const result = await findMany(makeClient(acc), "post", {});
    expect(result.meta.totalPages).toBe(1);
  });

  it("hasNextPage is true when total exceeds one page", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(30),
    });
    const result = await findMany(makeClient(acc), "post", { page: 1, limit: 10 });
    expect(result.meta.hasNextPage).toBe(true);
  });

  it("hasPreviousPage is true on page > 1", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(30),
    });
    const result = await findMany(makeClient(acc), "post", { page: 3, limit: 10 });
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  it("applies customFilters", async () => {
    const acc = makeAccessor({
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    });
    await findMany(makeClient(acc), "post", { customFilters: { createdBy: "abc" } });
    expect(acc.findMany.mock.calls[0][0].where.createdBy).toBe("abc");
  });
});

describe("createRecord", () => {
  it("delegates to prisma create", async () => {
    const acc = makeAccessor({ create: jest.fn().mockResolvedValue({ id: "1" }) });
    const result = await createRecord(makeClient(acc), "post", { title: "Hello" });
    expect(acc.create).toHaveBeenCalledWith({ data: { title: "Hello" } });
    expect(result).toEqual({ id: "1" });
  });
});

describe("updateRecord", () => {
  it("delegates to prisma update", async () => {
    const acc = makeAccessor({ update: jest.fn().mockResolvedValue({ id: "1" }) });
    await updateRecord(makeClient(acc), "post", "1", { title: "New" });
    expect(acc.update).toHaveBeenCalledWith({ where: { id: "1" }, data: { title: "New" } });
  });
});

describe("softDelete", () => {
  it("sets deletedAt, isDeleted=true", async () => {
    const acc = makeAccessor({ update: jest.fn().mockResolvedValue({ id: "1" }) });
    await softDelete(makeClient(acc), "post", "1");
    const data = acc.update.mock.calls[0][0].data;
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(data.isDeleted).toBe(true);
    expect(data.deletedBy).toBeUndefined();
  });

  it("includes deletedBy when provided", async () => {
    const acc = makeAccessor({ update: jest.fn().mockResolvedValue({ id: "1" }) });
    await softDelete(makeClient(acc), "post", "1", "user-42");
    expect(acc.update.mock.calls[0][0].data.deletedBy).toBe("user-42");
  });
});

describe("softDeleteMany", () => {
  it("calls updateMany and returns count", async () => {
    const acc = makeAccessor({ updateMany: jest.fn().mockResolvedValue({ count: 3 }) });
    const result = await softDeleteMany(makeClient(acc), "post", ["1", "2", "3"]);
    expect(result).toBe(3);
    const call = acc.updateMany.mock.calls[0][0];
    expect(call.where.id).toEqual({ in: ["1", "2", "3"] });
    expect(call.data.isDeleted).toBe(true);
  });

  it("includes deletedBy when provided", async () => {
    const acc = makeAccessor({ updateMany: jest.fn().mockResolvedValue({ count: 1 }) });
    await softDeleteMany(makeClient(acc), "post", ["1"], "user-5");
    expect(acc.updateMany.mock.calls[0][0].data.deletedBy).toBe("user-5");
  });
});

describe("countRecords", () => {
  it("counts with soft-delete guard", async () => {
    const acc = makeAccessor({ count: jest.fn().mockResolvedValue(4) });
    const result = await countRecords(makeClient(acc), "post");
    expect(acc.count).toHaveBeenCalledWith({
      where: { deletedAt: null, isDeleted: false },
    });
    expect(result).toBe(4);
  });

  it("merges extra filters", async () => {
    const acc = makeAccessor({ count: jest.fn().mockResolvedValue(2) });
    await countRecords(makeClient(acc), "post", { createdBy: "abc" });
    expect(acc.count).toHaveBeenCalledWith({
      where: { deletedAt: null, isDeleted: false, createdBy: "abc" },
    });
  });
});
