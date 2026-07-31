import "./env.js";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { connect, getDb } from "./db.js";
import { signToken, requireAuth } from "./auth.js";
import {
  loginIpLimit,
  loginEmailLimit,
  registerLimit,
  forgotIpLimit,
  forgotEmailLimit,
  resetLimit,
} from "./rateLimit.js";
import { sendPasswordReset, mailConfigured } from "./email.js";

const MAX_HABITS = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isProduction = process.env.NODE_ENV === "production";

const app = express();
// Behind nginx (and Cloudflare), so req.ip should come from X-Forwarded-For.
app.set("trust proxy", true);
// In production nginx serves the SPA and the API from the same origin, so CORS
// is unnecessary. In dev the Vite server is a different origin, so allow it.
if (!isProduction) app.use(cors());
app.use(express.json());

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.get("/api/health", (req, res) => res.json({ ok: true }));

/* ---------------------------------- auth ---------------------------------- */

app.post(
  "/api/auth/register",
  registerLimit,
  wrap(async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (!email.includes("@")) return res.status(400).json({ error: "Enter a valid email" });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const users = getDb().collection("users");
    if (await users.findOne({ email }))
      return res.status(409).json({ error: "That email is already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const { insertedId } = await users.insertOne({
      email,
      passwordHash,
      createdAt: new Date(),
    });

    res.json({ token: signToken({ _id: insertedId, email }), email });
  })
);

app.post(
  "/api/auth/login",
  loginIpLimit,
  loginEmailLimit,
  wrap(async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    const user = await getDb().collection("users").findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      return res.status(401).json({ error: "Email or password is incorrect" });

    res.json({ token: signToken(user), email: user.email });
  })
);

app.get("/api/auth/me", requireAuth, (req, res) => res.json({ email: req.email }));

/* ----------------------------- password reset ----------------------------- */

const RESET_TTL_MS = 60 * 60_000;
const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

app.post(
  "/api/auth/forgot",
  forgotIpLimit,
  forgotEmailLimit,
  wrap(async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    // Always the same reply, whether or not the account exists — otherwise this
    // endpoint tells an attacker which emails are registered.
    const generic = { ok: true };

    if (!email.includes("@")) return res.json(generic);
    if (!mailConfigured()) {
      console.error("Password reset requested but RESEND_API_KEY is not set");
      return res.json(generic);
    }

    const db = getDb();
    const user = await db.collection("users").findOne({ email });
    if (!user) return res.json(generic);

    // Only the hash is stored, so a database leak can't be used to reset accounts.
    const token = crypto.randomBytes(32).toString("base64url");
    await db.collection("resets").insertOne({
      userId: user._id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
      createdAt: new Date(),
    });

    const base = (process.env.APP_URL || "https://openhabit.co").replace(/\/$/, "");
    try {
      await sendPasswordReset(user.email, `${base}/reset?token=${token}`);
    } catch (err) {
      // Don't leak delivery failures to the caller; they'd reveal the account exists.
      console.error("Failed to send reset email:", err.message);
    }

    res.json(generic);
  })
);

app.post(
  "/api/auth/reset",
  resetLimit,
  wrap(async (req, res) => {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");

    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters" });

    const db = getDb();
    const invalid = { error: "That reset link is invalid or has expired" };

    // Single use: delete on claim, so a replayed link finds nothing.
    const reset = await db.collection("resets").findOneAndDelete({ tokenHash: hashToken(token) });
    if (!reset) return res.status(400).json(invalid);
    if (reset.expiresAt <= new Date()) return res.status(400).json(invalid);

    const user = await db.collection("users").findOne({ _id: reset.userId });
    if (!user) return res.status(400).json(invalid);

    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .collection("users")
      .updateOne({ _id: user._id }, { $set: { passwordHash, passwordChangedAt: new Date() } });

    // Any other outstanding links for this account are now void.
    await db.collection("resets").deleteMany({ userId: user._id });

    res.json({ token: signToken(user), email: user.email });
  })
);

/* --------------------------------- habits --------------------------------- */

app.get(
  "/api/habits",
  requireAuth,
  wrap(async (req, res) => {
    const habits = await getDb()
      .collection("habits")
      .find({ userId: req.userId })
      .sort({ order: 1 })
      .toArray();

    res.json(habits.map((h) => ({ id: h._id.toString(), name: h.name, order: h.order })));
  })
);

app.post(
  "/api/habits",
  requireAuth,
  wrap(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Give the habit a name" });
    if (name.length > 80) return res.status(400).json({ error: "Name is too long" });

    const habits = getDb().collection("habits");
    const count = await habits.countDocuments({ userId: req.userId });
    if (count >= MAX_HABITS)
      return res.status(400).json({ error: `You can track at most ${MAX_HABITS} habits` });

    const last = await habits.find({ userId: req.userId }).sort({ order: -1 }).limit(1).next();
    const order = last ? last.order + 1 : 0;

    const { insertedId } = await habits.insertOne({
      userId: req.userId,
      name,
      order,
      createdAt: new Date(),
    });

    res.json({ id: insertedId.toString(), name, order });
  })
);

app.patch(
  "/api/habits/:id",
  requireAuth,
  wrap(async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Give the habit a name" });

    const result = await getDb()
      .collection("habits")
      .updateOne(
        { _id: new ObjectId(req.params.id), userId: req.userId },
        { $set: { name } }
      );

    if (!result.matchedCount) return res.status(404).json({ error: "Habit not found" });
    res.json({ id: req.params.id, name });
  })
);

app.delete(
  "/api/habits/:id",
  requireAuth,
  wrap(async (req, res) => {
    const habitId = new ObjectId(req.params.id);
    const db = getDb();

    const result = await db.collection("habits").deleteOne({ _id: habitId, userId: req.userId });
    if (!result.deletedCount) return res.status(404).json({ error: "Habit not found" });

    await db.collection("checks").deleteMany({ userId: req.userId, habitId });
    res.json({ ok: true });
  })
);

/* --------------------------------- checks --------------------------------- */

app.get(
  "/api/checks",
  requireAuth,
  wrap(async (req, res) => {
    const { start, end } = req.query;
    if (!DATE_RE.test(start || "") || !DATE_RE.test(end || ""))
      return res.status(400).json({ error: "start and end must be YYYY-MM-DD" });

    const checks = await getDb()
      .collection("checks")
      .find({ userId: req.userId, date: { $gte: start, $lte: end } })
      .toArray();

    res.json(checks.map((c) => ({ habitId: c.habitId.toString(), date: c.date })));
  })
);

// Toggle a single habit/day cell. Returns the resulting state.
app.post(
  "/api/checks/toggle",
  requireAuth,
  wrap(async (req, res) => {
    const { habitId, date } = req.body;
    if (!DATE_RE.test(date || ""))
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });

    const db = getDb();
    const _habitId = new ObjectId(habitId);

    const habit = await db.collection("habits").findOne({ _id: _habitId, userId: req.userId });
    if (!habit) return res.status(404).json({ error: "Habit not found" });

    const filter = { userId: req.userId, habitId: _habitId, date };
    const existing = await db.collection("checks").findOne(filter);

    if (existing) {
      await db.collection("checks").deleteOne(filter);
      return res.json({ habitId, date, checked: false });
    }

    await db.collection("checks").insertOne({ ...filter, createdAt: new Date() });
    res.json({ habitId, date, checked: true });
  })
);

/* --------------------------------- moods ---------------------------------- */

app.get(
  "/api/moods",
  requireAuth,
  wrap(async (req, res) => {
    const { start, end } = req.query;
    if (!DATE_RE.test(start || "") || !DATE_RE.test(end || ""))
      return res.status(400).json({ error: "start and end must be YYYY-MM-DD" });

    const moods = await getDb()
      .collection("moods")
      .find({ userId: req.userId, date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .toArray();

    res.json(moods.map((m) => ({ date: m.date, value: m.value })));
  })
);

app.put(
  "/api/moods",
  requireAuth,
  wrap(async (req, res) => {
    const { date } = req.body;
    const value = Number(req.body.value);

    if (!DATE_RE.test(date || ""))
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    if (!Number.isFinite(value) || value < 1 || value > 10)
      return res.status(400).json({ error: "Mood must be between 1 and 10" });

    await getDb()
      .collection("moods")
      .updateOne(
        { userId: req.userId, date },
        { $set: { value, updatedAt: new Date() } },
        { upsert: true }
      );

    res.json({ date, value });
  })
);

app.delete(
  "/api/moods/:date",
  requireAuth,
  wrap(async (req, res) => {
    if (!DATE_RE.test(req.params.date))
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });

    await getDb().collection("moods").deleteOne({ userId: req.userId, date: req.params.date });
    res.json({ ok: true });
  })
);

/* --------------------------------------------------------------------------- */

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

const port = process.env.PORT || 4000;
// Loopback only: nginx is the sole thing that should reach the BFF.
const host = process.env.HOST || "127.0.0.1";
connect()
  .then(() => {
    app.listen(port, host, () => console.log(`OpenHabit BFF listening on ${host}:${port}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
