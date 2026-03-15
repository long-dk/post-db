import { createPostDbManager, resetPostDbManager } from "../../src/client/prisma.client";

jest.mock("@prisma/client", () => {
  const disconnect = jest.fn().mockResolvedValue(undefined);
  const MockPrismaClient = jest.fn().mockImplementation(() => ({
    $disconnect: disconnect,
    post: {},
  }));
  return { PrismaClient: MockPrismaClient };
});

jest.mock("../../src/repositories/post.repository", () => ({
  PostRepository: jest.fn().mockImplementation(() => ({})),
}));

describe("createPostDbManager", () => {
  beforeEach(() => {
    resetPostDbManager();
  });

  it("creates a new instance on first call", () => {
    const manager = createPostDbManager("postgresql://test");
    expect(manager).toBeDefined();
    expect(manager.postRepository).toBeDefined();
  });

  it("returns the same singleton on subsequent calls", () => {
    const m1 = createPostDbManager("postgresql://test");
    const m2 = createPostDbManager("postgresql://other");
    expect(m1).toBe(m2);
  });

  it("resetPostDbManager clears the singleton", () => {
    const m1 = createPostDbManager("postgresql://test");
    resetPostDbManager();
    const m2 = createPostDbManager("postgresql://test");
    expect(m1).not.toBe(m2);
  });

  it("disconnect calls prisma.$disconnect", async () => {
    const manager = createPostDbManager("postgresql://test");
    await expect(manager.disconnect()).resolves.toBeUndefined();
  });
});
