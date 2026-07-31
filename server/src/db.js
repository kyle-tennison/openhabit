import { MongoClient } from "mongodb";

let db;

export async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  const client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || "openhabit");

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("habits").createIndex({ userId: 1, order: 1 });
  await db
    .collection("checks")
    .createIndex({ userId: 1, habitId: 1, date: 1 }, { unique: true });
  await db.collection("checks").createIndex({ userId: 1, date: 1 });
  await db
    .collection("moods")
    .createIndex({ userId: 1, date: 1 }, { unique: true });

  await db.collection("resets").createIndex({ tokenHash: 1 }, { unique: true });
  // Mongo removes reset tokens on its own once they expire.
  await db.collection("resets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not connected");
  return db;
}
