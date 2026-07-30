import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const secret = () => process.env.JWT_SECRET || "openhabit-dev-secret";

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), email: user.email }, secret(), {
    expiresIn: "30d",
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in" });

  try {
    const payload = jwt.verify(token, secret());
    req.userId = new ObjectId(payload.sub);
    req.email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Session expired, sign in again" });
  }
}
