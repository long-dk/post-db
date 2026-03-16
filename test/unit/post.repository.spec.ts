import { PostRepository } from "../../src/repositories/post.repository";
import { PrismaClient } from "../../generated/prisma/client";
import * as ops from "../../src/operations/base.operations";

jest.mock("../../src/operations/base.operations");

const mockOps = ops as jest.Mocked<typeof ops>;

function makeClient() {
  return {} as unknown as PrismaClient;
}

describe("PostRepository", () => {
  let repo: PostRepository;
  let client: PrismaClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = makeClient();
    repo = new PostRepository(client);
  });

  it("findById delegates to findById op", async () => {
    mockOps.findById.mockResolvedValue({ id: "1" } as any);
    const result = await repo.findById("1");
    expect(mockOps.findById).toHaveBeenCalledWith(client, "post", "1");
    expect(result).toEqual({ id: "1" });
  });

  it("findOne delegates to findOne op", async () => {
    mockOps.findOne.mockResolvedValue(null);
    await repo.findOne({ title: "Hello" });
    expect(mockOps.findOne).toHaveBeenCalledWith(client, "post", { title: "Hello" });
  });

  it("findMany adds default searchFields", async () => {
    mockOps.findMany.mockResolvedValue({ items: [], meta: {} } as any);
    await repo.findMany({});
    const opts = mockOps.findMany.mock.calls[0][2];
    expect(opts.searchFields).toEqual(["title", "content"]);
  });

  it("findMany preserves provided searchFields", async () => {
    mockOps.findMany.mockResolvedValue({ items: [], meta: {} } as any);
    await repo.findMany({ searchFields: ["title"] });
    expect(mockOps.findMany.mock.calls[0][2].searchFields).toEqual(["title"]);
  });

  it("create delegates to createRecord op", async () => {
    mockOps.createRecord.mockResolvedValue({ id: "2" } as any);
    const input = { title: "T", content: "C", createdBy: "u1" };
    await repo.create(input);
    expect(mockOps.createRecord).toHaveBeenCalledWith(client, "post", input);
  });

  it("update delegates to updateRecord op", async () => {
    mockOps.updateRecord.mockResolvedValue({ id: "1" } as any);
    await repo.update("1", { title: "New" });
    expect(mockOps.updateRecord).toHaveBeenCalledWith(client, "post", "1", { title: "New" });
  });

  it("softDelete delegates to softDelete op without deletedBy", async () => {
    mockOps.softDelete.mockResolvedValue({ id: "1" } as any);
    await repo.softDelete("1");
    expect(mockOps.softDelete).toHaveBeenCalledWith(client, "post", "1", undefined);
  });

  it("softDelete passes deletedBy when provided", async () => {
    mockOps.softDelete.mockResolvedValue({ id: "1" } as any);
    await repo.softDelete("1", "user-42");
    expect(mockOps.softDelete).toHaveBeenCalledWith(client, "post", "1", "user-42");
  });

  it("softDeleteMany delegates to softDeleteMany op", async () => {
    mockOps.softDeleteMany.mockResolvedValue(3);
    const result = await repo.softDeleteMany(["1", "2", "3"]);
    expect(mockOps.softDeleteMany).toHaveBeenCalledWith(client, "post", ["1", "2", "3"], undefined);
    expect(result).toBe(3);
  });

  it("softDeleteMany passes deletedBy", async () => {
    mockOps.softDeleteMany.mockResolvedValue(1);
    await repo.softDeleteMany(["1"], "user-9");
    expect(mockOps.softDeleteMany).toHaveBeenCalledWith(client, "post", ["1"], "user-9");
  });

  it("count delegates to countRecords op", async () => {
    mockOps.countRecords.mockResolvedValue(5);
    const result = await repo.count({ createdBy: "abc" } as any);
    expect(mockOps.countRecords).toHaveBeenCalledWith(client, "post", { createdBy: "abc" });
    expect(result).toBe(5);
  });

  it("count with no filter passes undefined", async () => {
    mockOps.countRecords.mockResolvedValue(0);
    await repo.count();
    expect(mockOps.countRecords).toHaveBeenCalledWith(client, "post", undefined);
  });
});
