// ============================================================
// RESALEIQ — Structured Logger
// Server-side only. Never import in client components.
// Outputs JSON-structured logs compatible with Vercel log drain.
// ============================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  | "audit"       // lead capture, form submission
  | "admin"       // admin dashboard operations
  | "supabase"    // database queries and failures
  | "auth"        // authentication and session events
  | "scoring"     // inventory / audit scoring engine
  | "runtime"     // unexpected runtime errors
  | "deploy"      // deployment and startup events
  | "ingestion";  // inventory import, parsing, normalization

export interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId?: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    // Stack intentionally excluded from structured output — use Vercel log viewer
  };
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const IS_DEV = process.env.NODE_ENV === "development";

function write(entry: LogEntry): void {
  // In production, emit compact JSON for Vercel log drain / structured parsing
  if (IS_PRODUCTION) {
    const output = {
      ts: new Date().toISOString(),
      lvl: entry.level,
      cat: entry.category,
      msg: entry.message,
      ...(entry.correlationId ? { cid: entry.correlationId } : {}),
      ...(entry.durationMs !== undefined ? { ms: entry.durationMs } : {}),
      ...(entry.meta ? { meta: entry.meta } : {}),
      ...(entry.error ? { err: entry.error } : {}),
    };
    // Route to stderr for errors, stdout for everything else
    if (entry.level === "error") {
      process.stderr.write(JSON.stringify(output) + "\n");
    } else {
      process.stdout.write(JSON.stringify(output) + "\n");
    }
    return;
  }

  // In dev, pretty-print with color prefix
  if (IS_DEV) {
    const prefix = {
      debug: "\x1b[2m[debug]\x1b[0m",
      info:  "\x1b[36m[info] \x1b[0m",
      warn:  "\x1b[33m[warn] \x1b[0m",
      error: "\x1b[31m[error]\x1b[0m",
    }[entry.level];

    const parts = [prefix, `[${entry.category}]`, entry.message];
    if (entry.correlationId) parts.push(`cid=${entry.correlationId}`);
    if (entry.durationMs !== undefined) parts.push(`(${entry.durationMs}ms)`);

    const fn = entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log;
    fn(parts.join(" "));

    if (entry.meta && Object.keys(entry.meta).length) fn("  meta:", entry.meta);
    if (entry.error) fn("  error:", entry.error);
    return;
  }

  // Test / other environments — minimal output
  console.log(`[${entry.level}][${entry.category}] ${entry.message}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  debug(category: LogCategory, message: string, meta?: Record<string, unknown>) {
    if (IS_PRODUCTION) return; // no debug in prod
    write({ level: "debug", category, message, meta });
  },

  info(category: LogCategory, message: string, meta?: Record<string, unknown>) {
    write({ level: "info", category, message, meta });
  },

  warn(category: LogCategory, message: string, meta?: Record<string, unknown>) {
    write({ level: "warn", category, message, meta });
  },

  error(category: LogCategory, message: string, err?: unknown, meta?: Record<string, unknown>) {
    const errorEntry = err instanceof Error
      ? { message: err.message, code: (err as NodeJS.ErrnoException).code }
      : err
        ? { message: String(err) }
        : undefined;
    write({ level: "error", category, message, error: errorEntry, meta });
  },

  // ─── Scoped loggers for common operations ──────────────────────────────────

  /** Log an audit form submission with timing */
  auditSubmit(opts: {
    correlationId: string;
    platform: string;
    inventoryCount: string;
    success: boolean;
    durationMs?: number;
    errorMessage?: string;
  }) {
    if (opts.success) {
      write({
        level: "info",
        category: "audit",
        message: "Audit lead submitted",
        correlationId: opts.correlationId,
        durationMs: opts.durationMs,
        meta: { platform: opts.platform, inventoryCount: opts.inventoryCount },
      });
    } else {
      write({
        level: "error",
        category: "audit",
        message: "Audit lead submission failed",
        correlationId: opts.correlationId,
        durationMs: opts.durationMs,
        error: opts.errorMessage ? { message: opts.errorMessage } : undefined,
        meta: { platform: opts.platform, inventoryCount: opts.inventoryCount },
      });
    }
  },

  /** Log a Supabase query failure */
  supabaseError(table: string, operation: string, errorMessage: string, meta?: Record<string, unknown>) {
    write({
      level: "error",
      category: "supabase",
      message: `${operation} failed on ${table}`,
      error: { message: errorMessage },
      meta,
    });
  },

  /** Log an admin action */
  adminAction(action: string, leadId: string, newStatus: string) {
    write({
      level: "info",
      category: "admin",
      message: `Lead status updated: ${action}`,
      meta: { leadId, newStatus },
    });
  },
};
