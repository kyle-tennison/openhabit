// Minimal fixed-window rate limiter, in memory. Single process behind nginx, so
// there is nothing to share state with — a Map is enough and avoids a dependency.

const buckets = new Map();

// Drop expired buckets every 5 minutes so the Map can't grow without bound.
// unref() so this timer never holds the process open.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}, 5 * 60_000).unref();

/**
 * The real client address. Cloudflare sets CF-Connecting-IP; nginx forwards it
 * and appends to X-Forwarded-For. Both are spoofable by anyone hitting the
 * origin directly, which is why login is also limited per-email below.
 */
export function clientIp(req) {
  return (
    req.get("cf-connecting-ip") ||
    (req.get("x-forwarded-for") || "").split(",")[0].trim() ||
    req.ip ||
    "unknown"
  );
}

export function rateLimit({ windowMs, max, key, message }) {
  return (req, res, next) => {
    const id = key(req);
    if (!id) return next();

    const now = Date.now();
    let bucket = buckets.get(id);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(id, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

const emailOf = (req) =>
  String(req.body?.email || "")
    .trim()
    .toLowerCase() || null;

// Per-IP: blunt cap on automated guessing from one source.
export const loginIpLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  key: (req) => `login:ip:${clientIp(req)}`,
  message: "Too many sign-in attempts. Try again in a few minutes.",
});

// Per-email: survives IP rotation, and can't be spoofed by headers.
export const loginEmailLimit = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  key: (req) => (emailOf(req) ? `login:email:${emailOf(req)}` : null),
  message: "Too many sign-in attempts for this account. Try again in a few minutes.",
});

export const registerLimit = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  key: (req) => `register:ip:${clientIp(req)}`,
  message: "Too many accounts created from here. Try again later.",
});
