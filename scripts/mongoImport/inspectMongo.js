import "../../Config/env.js";
import mongoose from "mongoose";

const CANDIDATES = [
  "pricings",
  "pricing",
  "clients",
  "orders",
  "reservations",
  "clientquotas",
  "callmonitors",
  "failedextractions",
  "instances",
];

async function distinctIds(collection) {
  const values = await collection.distinct("instanceId");
  return values.map((value) => (value == null || value === "" ? "(vide)" : String(value)));
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI requis");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  let databases = [];
  try {
    const listed = await db.admin().listDatabases({ nameOnly: true });
    databases = (listed.databases || []).map((item) => item.name).filter((name) => !["admin", "local"].includes(name));
  } catch {
    databases = [db.databaseName];
  }
  const inventories = [];
  for (const databaseName of databases) {
    const target = mongoose.connection.useDb(databaseName, { useCache: true });
    const existing = await target.db.listCollections().toArray();
    const details = [];
    for (const item of existing.map((entry) => entry.name).sort()) {
      const collection = target.db.collection(item);
      const count = await collection.estimatedDocumentCount();
      const row = { name: item, count };
      if (CANDIDATES.includes(item) || /pric|order|reserv|client|call|quota|extract|instance/i.test(item)) {
        row.instanceIds = await distinctIds(collection);
      }
      details.push(row);
    }
    inventories.push({ database: databaseName, collections: details });
  }
  process.stdout.write(
    `${JSON.stringify({ connectedDatabase: db.databaseName, inventories }, null, 2)}\n`
  );
  await mongoose.connection.close();
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
