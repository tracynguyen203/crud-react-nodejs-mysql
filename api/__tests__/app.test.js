const request = require("supertest");
const { createApp, isValidItem, isValidId } = require("../app");

// Minimal fake of the mysql pool: each test decides what query() returns.
const makeDb = (impl) => ({ query: jest.fn(impl) });
const ok = (result) => (sql, params, cb) => (cb || params)(null, result);
const boom = () => (sql, params, cb) => (cb || params)(new Error("db down"));

beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("validators", () => {
  test("isValidItem", () => {
    expect(isValidItem("milk")).toBe(true);
    expect(isValidItem("")).toBe(false);
    expect(isValidItem("   ")).toBe(false);
    expect(isValidItem(undefined)).toBe(false);
    expect(isValidItem("x".repeat(31))).toBe(false);
  });
  test("isValidId", () => {
    expect(isValidId("5")).toBe(true);
    expect(isValidId(0)).toBe(false);
    expect(isValidId("abc")).toBe(false);
    expect(isValidId("1.5")).toBe(false);
  });
});

describe("GET /", () => {
  test("returns welcome message", async () => {
    const res = await request(createApp(makeDb(ok([])))).get("/");
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Welcome/);
  });
});

describe("GET /health", () => {
  test("200 when DB reachable", async () => {
    const res = await request(createApp(makeDb(ok([])))).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
  test("503 when DB unreachable", async () => {
    const res = await request(createApp(makeDb(boom()))).get("/health");
    expect(res.status).toBe(503);
  });
});

describe("GET /api/get", () => {
  test("returns items", async () => {
    const rows = [{ id: 1, item: "milk" }];
    const res = await request(createApp(makeDb(ok(rows)))).get("/api/get");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
  });
  test("500 on DB error", async () => {
    const res = await request(createApp(makeDb(boom()))).get("/api/get");
    expect(res.status).toBe(500);
  });
});

describe("POST /api/insert", () => {
  test("inserts and returns insertId", async () => {
    const db = makeDb(ok({ insertId: 7 }));
    const res = await request(createApp(db)).post("/api/insert").send({ item: "eggs" });
    expect(res.status).toBe(200);
    expect(res.body.insertId).toBe(7);
    expect(db.query.mock.calls[0][1]).toEqual(["eggs"]);
  });
  test("400 for empty / missing item", async () => {
    const db = makeDb(ok({}));
    const app = createApp(db);
    expect((await request(app).post("/api/insert").send({ item: "" })).status).toBe(400);
    expect((await request(app).post("/api/insert").send({})).status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
  test("500 on DB error", async () => {
    const res = await request(createApp(makeDb(boom()))).post("/api/insert").send({ item: "x" });
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/update", () => {
  test("updates an item", async () => {
    const db = makeDb(ok({ affectedRows: 1 }));
    const res = await request(createApp(db)).put("/api/update").send({ id: 3, itemU: "bread" });
    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][1]).toEqual(["bread", 3]);
  });
  test("400 for bad input", async () => {
    const app = createApp(makeDb(ok({})));
    expect((await request(app).put("/api/update").send({ id: "x", itemU: "a" })).status).toBe(400);
    expect((await request(app).put("/api/update").send({ id: 1, itemU: "" })).status).toBe(400);
  });
  test("500 on DB error", async () => {
    const res = await request(createApp(makeDb(boom()))).put("/api/update").send({ id: 1, itemU: "a" });
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/delete/:id", () => {
  test("deletes an item", async () => {
    const db = makeDb(ok({ affectedRows: 1 }));
    const res = await request(createApp(db)).delete("/api/delete/9");
    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][1]).toEqual(["9"]);
  });
  test("400 for non-numeric id", async () => {
    const res = await request(createApp(makeDb(ok({})))).delete("/api/delete/abc");
    expect(res.status).toBe(400);
  });
  test("500 on DB error", async () => {
    const res = await request(createApp(makeDb(boom()))).delete("/api/delete/1");
    expect(res.status).toBe(500);
  });
});
