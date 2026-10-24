// Lets node --experimental-strip-types load lib/ files that import without a .ts extension.
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) { if (spec.startsWith(".") && !spec.endsWith(".ts")) return next(spec + ".ts", ctx); throw e; }
}`));
