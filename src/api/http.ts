import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

const normalizeForJson = (value: unknown): JsonValue => {
  if (value === undefined) return null;

  if (typeof value === "bigint") {
    const numberValue = Number(value);
    return Number.isSafeInteger(numberValue) ? numberValue : value.toString();
  }

  if (Array.isArray(value)) return value.map(normalizeForJson);

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeForJson(nestedValue),
      ]),
    );
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  throw new TypeError("Unsupported value in database JSON response");
};

export const json = (c: Context, value: unknown) =>
  c.body(JSON.stringify(normalizeForJson(value)), 200, {
    "Content-Type": "application/json",
  });

export const integer = (value: string, name: string) => {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new HTTPException(400, { message: `${name} must be an integer` });
  }
  return parsed;
};

export const integerQuery = (c: Context, name: string) => {
  const value = c.req.query(name);
  return value === undefined ? undefined : integer(value, name);
};

export const booleanQuery = (c: Context, name: string) => {
  const value = c.req.query(name);
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new HTTPException(400, { message: `${name} must be true or false` });
};

export const address = (value: string, name = "address") => {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new HTTPException(400, { message: `${name} must be an EVM address` });
  }
  return value.toLowerCase();
};

export const addressQuery = (c: Context, name: string) => {
  const value = c.req.query(name);
  return value === undefined ? undefined : address(value, name);
};

export const pagination = (c: Context) => {
  const limit = integerQuery(c, "limit") ?? 50;
  const offset = integerQuery(c, "offset") ?? 0;
  if (limit < 1 || limit > 100) {
    throw new HTTPException(400, {
      message: "limit must be between 1 and 100",
    });
  }
  if (offset < 0) {
    throw new HTTPException(400, { message: "offset must be zero or greater" });
  }
  return { limit, offset };
};

export const includeSet = (
  c: Context,
  allowed: readonly string[],
  defaultIncludes: readonly string[],
) => {
  const raw = c.req.query("include");
  const values =
    raw === undefined ? defaultIncludes : raw.split(",").filter(Boolean);
  const invalid = values.filter((value) => !allowed.includes(value));
  if (invalid.length > 0) {
    throw new HTTPException(400, {
      message: `Unknown include value: ${invalid.join(", ")}`,
    });
  }
  return new Set(values);
};
