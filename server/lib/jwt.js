import jwt from "jsonwebtoken";
import { JWT_SECRET, IS_PROD } from "./config.js";

const DEV_DEFAULT = "dev-insecure-change-me";

export function signToken(payload, expiresIn = "7d") {
  if (IS_PROD && JWT_SECRET === DEV_DEFAULT) {
    throw new Error("JWT_SECRET must be set to a strong random value in production");
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
