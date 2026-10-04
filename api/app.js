const express = require("express");
const cors = require("cors");

const MAX_ITEM_LENGTH = 30; // matches items.ITEM VARCHAR(30)

const isValidItem = (value) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= MAX_ITEM_LENGTH;

const isValidId = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

/**
 * Builds the Express app. The DB handle is injected so the app can be
 * unit-tested without a real MySQL server.
 */
function createApp(db, { webHost } = {}) {
  const app = express();

  app.use(cors({ origin: webHost }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const fail = (res, err) => {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  };

  app.get("/", (req, res) => {
    res.json({ message: "Welcome to My CRUD App." });
  });

  // Liveness/readiness probe used by Docker healthchecks, smoke tests and Uptime Kuma
  app.get("/health", (req, res) => {
    db.query("SELECT 1", (err) => {
      if (err) {
        console.error(err);
        return res.status(503).json({ status: "unhealthy" });
      }
      return res.json({ status: "ok" });
    });
  });

  app.get("/api/get", (req, res) => {
    db.query("SELECT id, item FROM items;", (err, result) =>
      err ? fail(res, err) : res.send(result)
    );
  });

  app.post("/api/insert", (req, res) => {
    const { item } = req.body;
    if (!isValidItem(item)) {
      return res.status(400).json({ error: `item must be 1-${MAX_ITEM_LENGTH} characters` });
    }
    return db.query("INSERT INTO items (item) VALUES (?);", [item], (err, result) =>
      err ? fail(res, err) : res.send(result)
    );
  });

  app.put("/api/update", (req, res) => {
    const { id, itemU } = req.body;
    if (!isValidId(id) || !isValidItem(itemU)) {
      return res.status(400).json({ error: "valid id and itemU are required" });
    }
    return db.query("UPDATE items SET item = ? WHERE id = ?;", [itemU, id], (err, result) =>
      err ? fail(res, err) : res.send(result)
    );
  });

  app.delete("/api/delete/:id", (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ error: "valid id is required" });
    }
    return db.query("DELETE FROM items WHERE id = ?;", [id], (err, result) =>
      err ? fail(res, err) : res.send(result)
    );
  });

  return app;
}

module.exports = { createApp, isValidItem, isValidId };
