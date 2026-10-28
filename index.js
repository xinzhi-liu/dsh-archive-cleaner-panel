/**
 * Host half of the archive-cleaner bundle.
 *
 * The browser panel needs two capabilities the Client cannot perform:
 *  - identify the profile's default Workspace and its archived members;
 *  - remove a Session's durable artifacts and every registry reference.
 *
 * Both are exposed as authenticated, owner-only exact Fetch routes on the
 * existing Connection service. The routes deliberately accept no principal
 * other than the browser owner, so the panel never widens the app's access
 * surface.
 */

import { rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve } from 'node:path';

/** Stable Cordis plugin name and Loader row id. */
export const name = 'archive-cleaner';

/**
 * Services required before the routes can be mounted. `sessions`, `agents`,
 * and `sessionProjectionCache` are read lazily because a composition may omit
 * them and the panel must still be able to list cleanly.
 */
export const inject = ['connection', 'workspaceRegistry', 'sessionPersistence'];

/** Body limit for the delete request; a selection is capped well below this. */
const MAX_BODY_BYTES = 32 * 1024;
/** One request may name this many top-level Sessions. */
const MAX_SELECTION = 100;

/** A failure that maps to one HTTP response. */
class RequestError extends Error {
  /**
   * @param {number} status - HTTP status.
   * @param {string} code - stable machine-readable code.
   * @param {string} message - diagnostic text.
   * @param {Record<string, unknown>} [details] - safe structured details.
   */
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'ArchiveCleanerRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * JSON response with no-store caching.
 * @param {number} status - HTTP status.
 * @param {unknown} body - serializable body.
 * @returns {Response} the response.
 */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/**
 * Normalize one persistence snapshot to its Session header.
 * @param {unknown} entry - snapshot or bare header.
 * @returns {Record<string, any> | undefined} the header.
 */
function headerOf(entry) {
  if (entry === null || typeof entry !== 'object') return undefined;
  const header = entry.header;
  if (header !== null && typeof header === 'object') return header;
  return entry;
}

/**
 * Read the default Workspace entity from the registry.
 *
 * `defaultWorkspaceId` is the exact identity the registry retained for
 * first-use creation. Older profiles that never recorded it fall back to a
 * Workspace whose path is the process working directory, then to the first
 * registered Workspace.
 *
 * @param {any} registry - `ctx.workspaceRegistry`.
 * @returns {any | undefined} the Workspace entity.
 */
function defaultWorkspaceOf(registry) {
  const state = registry.state
    ?? (typeof registry.requireState === 'function' ? registry.requireState() : undefined);
  const workspaces = registry.list();
  if (state !== undefined && typeof state.defaultWorkspaceId === 'string') {
    const saved = registry.get(state.defaultWorkspaceId);
    if (saved !== undefined) return saved;
  }
  const cwd = resolve(process.cwd());
  const current = workspaces.find((workspace) => {
    try {
      return resolve(workspace.path) === cwd;
    } catch {
      return false;
    }
  });
  return current ?? workspaces[0];
}

/**
 * Collect subagent-origin descendants of the selected Sessions.
 *
 * A fork is an independent conversation even though it carries a
 * `parentSession` header, so only `origin: 'subagent'` lineage is followed.
 * The subagent logs are implementation artifacts of the selected
 * conversation and would otherwise be left orphaned on disk.
 *
 * @param {Map<string, Record<string, any>>} headers - all stored headers.
 * @param {Set<string>} roots - selected top-level Session ids.
 * @returns {Set<string>} every Session id to remove, including the roots.
 */
function withSubagentDescendants(headers, roots) {
  const children = new Map();
  for (const header of headers.values()) {
    if (header.origin !== 'subagent') continue;
    const parent = header.parentSession;
    if (typeof parent !== 'string' || parent.length === 0) continue;
    const list = children.get(parent) ?? [];
    list.push(header.id);
    children.set(parent, list);
  }
  const all = new Set(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift();
    for (const child of children.get(id) ?? []) {
      if (all.has(child)) continue;
      all.add(child);
      queue.push(child);
    }
  }
  return all;
}

/**
 * Resolve and validate the on-disk Session directory for one header.
 *
 * The JSONL backend's `locate()` is a stable refusal hook, not part of the
 * generic persistence contract. Refuse other providers instead of guessing a
 * path, and refuse any path that is not this exact session directory below the
 * configured root.
 *
 * @param {any} persistence - `ctx.sessionPersistence`.
 * @param {Record<string, any>} header - the stored Session header.
 * @returns {string | undefined} the directory, or undefined for a missing log.
 */
async function sessionDirectoryOf(persistence, header) {
  if (typeof persistence.locate !== 'function') {
    throw new RequestError(
      409,
      'UNSUPPORTED_BACKEND',
      'this profile uses a persistence backend without on-disk session locations',
    );
  }
  const location = persistence.locate(header);
  if (location === undefined || location === null || typeof location.path !== 'string') {
    throw new RequestError(409, 'UNSUPPORTED_BACKEND', `backend returned no location for ${header.id}`);
  }
  const root = typeof persistence.root === 'string' ? resolve(persistence.root) : undefined;
  if (root === undefined) {
    throw new RequestError(409, 'UNSUPPORTED_BACKEND', 'session persistence root is not observable');
  }
  const dir = resolve(dirname(location.path));
  const rel = relative(root, dir);
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel) || basename(dir) !== header.id) {
    throw new RequestError(500, 'UNSAFE_PATH', `refusing to remove unexpected session path: ${dir}`);
  }
  return dir;
}

/**
 * Mount the plugin's host routes.
 * @param {any} ctx - Cordis Host Context.
 */
export function apply(ctx) {
  const registry = ctx.workspaceRegistry;
  const persistence = ctx.sessionPersistence;

  /**
   * Read every stored header. A backend failure is not fatal for listing;
   * metadata-only rows still allow the user to ask for cleanup.
   * @returns {Promise<Map<string, Record<string, any>>>} headers by id.
   */
  async function readHeaders() {
    try {
      const snapshots = await persistence.list();
      const map = new Map();
      for (const snapshot of snapshots) {
        const header = headerOf(snapshot);
        if (header !== undefined && typeof header.id === 'string') map.set(header.id, header);
      }
      return map;
    } catch (error) {
      ctx.logger.warn(`archive-cleaner: cannot list stored sessions: ${String(error)}`);
      return new Map();
    }
  }

  /**
   * Current default-Workspace state for the panel.
   * @returns {Promise<object>} workspace metadata and archived rows.
   */
  async function snapshot() {
    const workspace = defaultWorkspaceOf(registry);
    if (workspace === undefined) {
      return { defaultWorkspaceId: null, workspace: null, rows: [] };
    }
    const archived = new Set(Array.from(registry.archivedSessionIds, String));
    const headers = await readHeaders();
    const sessions = ctx.get('sessions');
    const rows = workspace.sessionIds
      .filter((id) => archived.has(String(id)))
      .map((id) => {
        const header = headers.get(id);
        return {
          id,
          createdAt: typeof header?.createdAt === 'number' ? header.createdAt : 0,
          cwd: typeof header?.cwd === 'string' ? header.cwd : workspace.path,
          live: sessions?.get(id) !== undefined,
        };
      });
    return {
      defaultWorkspaceId: workspace.id,
      workspace: {
        workspaceId: workspace.id,
        title: workspace.title,
        path: workspace.path,
      },
      rows,
    };
  }

  /**
   * Remove one projection-cache record when the cache service is present.
   * @param {string} id - Session id.
   * @param {string[]} warnings - collected warnings.
   * @returns {Promise<void>}
   */
  async function removeProjectionCache(id, warnings) {
    const cache = ctx.get('sessionProjectionCache');
    if (cache === undefined) return;
    try {
      const table = cache.table
        ?? (typeof cache.requireTable === 'function' ? cache.requireTable() : undefined);
      if (table === undefined || typeof table.delete !== 'function') return;
      await table.delete(id);
    } catch (error) {
      warnings.push(`projection cache for ${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Wait for a short interval without keeping the event loop alive.
   * @param {number} ms - milliseconds.
   * @returns {Promise<void>} settlement after the delay.
   */
  function delay(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Make selected Sessions cold before their files are removed.
   *
   * An archived Session cannot run model work, but the process may still hold
   * its in-memory object and persistence handle after archiving. Stop any
   * registered Agent, detach the store entry (which drains and closes the
   * handle), and wait briefly for the store to let go. This is best-effort:
   * a still-live Session is refused rather than deleted underneath a writer.
   *
   * @param {Set<string>} ids - Sessions in the deletion plan.
   * @returns {Promise<void>}
   */
  async function makeCold(ids) {
    const sessions = ctx.get('sessions');
    if (sessions === undefined) return;
    const agents = ctx.get('agents');
    for (const id of ids) {
      if (sessions.get(id) === undefined) continue;
      const agent = agents?.get?.(id);
      if (agent === undefined) continue;
      try {
        agent.cancel?.({ kind: 'disposed' });
      } catch {
        // A settled or already-disposed agent needs no cancellation.
      }
      try {
        await Promise.race([
          Promise.resolve(agent.whenIdle?.()),
          delay(1500),
        ]);
      } catch {
        // Continue to the store detach; the archived gate still blocks work.
      }
    }

    for (const id of ids) {
      if (sessions.get(id) === undefined) continue;
      const entry = sessions.store?.get?.(id);
      if (entry !== undefined && typeof entry.detach === 'function') {
        try {
          entry.detach();
        } catch (error) {
          ctx.logger.warn(`archive-cleaner: cannot detach live session ${id}: ${String(error)}`);
        }
      }
    }

    const deadline = Date.now() + 1200;
    while (Date.now() < deadline && [...ids].some((id) => sessions.get(id) !== undefined)) {
      await delay(50);
    }
    const stillLive = [...ids].filter((id) => sessions.get(id) !== undefined);
    if (stillLive.length > 0) {
      throw new RequestError(
        409,
        'SESSION_LIVE',
        'one or more selected sessions are still loaded in memory; close them and retry',
        { sessionIds: stillLive },
      );
    }
  }

  /**
   * Remove every durable artifact and registry reference for the selection.
   * @param {string[]} rawIds - top-level archived Session ids.
   * @returns {Promise<object>} deletion report.
   */
  async function remove(rawIds) {
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      throw new RequestError(400, 'INVALID_REQUEST', 'select at least one archived session');
    }
    const selected = [];
    const seen = new Set();
    for (const value of rawIds) {
      if (typeof value !== 'string' || value.length === 0 || value.length > 200 || /[\\/\0]/u.test(value)) {
        throw new RequestError(400, 'INVALID_REQUEST', 'session ids must be non-empty path-safe strings');
      }
      if (seen.has(value)) continue;
      seen.add(value);
      selected.push(value);
    }
    if (selected.length > MAX_SELECTION) {
      throw new RequestError(400, 'INVALID_REQUEST', `at most ${MAX_SELECTION} sessions can be deleted at once`);
    }

    const workspace = defaultWorkspaceOf(registry);
    if (workspace === undefined) {
      throw new RequestError(409, 'NO_DEFAULT_WORKSPACE', 'this profile has no default workspace');
    }
    const archived = new Set(Array.from(registry.archivedSessionIds, String));
    const members = new Set(Array.from(workspace.sessionIds, String));
    const outside = selected.filter((id) => !archived.has(id) || !members.has(id));
    if (outside.length > 0) {
      throw new RequestError(
        409,
        'NOT_ARCHIVED_IN_DEFAULT_WORKSPACE',
        'only archived sessions in the default workspace can be deleted',
        { sessionIds: outside },
      );
    }

    const headers = await readHeaders();
    const selectedSet = new Set(selected);
    const purge = withSubagentDescendants(headers, selectedSet);

    // Check every path before touching a live Session or deleting any file, so
    // an unsupported backend cannot leave a detached or half-deleted selection.
    const directories = new Map();
    for (const id of purge) {
      const header = headers.get(id);
      if (header === undefined) continue;
      const dir = await sessionDirectoryOf(persistence, header);
      if (dir !== undefined) directories.set(id, dir);
    }

    await makeCold(purge);

    const deletedLogs = [];
    const missingLogs = [];
    const warnings = [];
    let filesTouched = false;
    for (const [id, dir] of directories) {
      let info;
      try {
        info = await stat(dir);
      } catch (error) {
        if (error !== null && typeof error === 'object' && error.code === 'ENOENT') {
          missingLogs.push(id);
          continue;
        }
        throw error;
      }
      if (!info.isDirectory()) {
        throw new RequestError(500, 'DELETE_FAILED', `session artifact is not a directory: ${dir}`);
      }
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 });
      try {
        await stat(dir);
      } catch (error) {
        if (error !== null && typeof error === 'object' && error.code === 'ENOENT') {
          filesTouched = true;
          deletedLogs.push(id);
          continue;
        }
        throw error;
      }
      throw new RequestError(500, 'DELETE_FAILED', `session directory still exists after removal: ${dir}`);
    }

    // The log is gone; from this point on a failure is a metadata cleanup
    // failure. The endpoint stays retryable because it accepts an archived
    // member whose log is already missing.
    try {
      for (const id of purge) await removeProjectionCache(id, warnings);

      for (const id of purge) {
        for (const candidate of registry.list()) {
          if (!candidate.sessionIds.includes(id)) continue;
          await candidate.detachSession(id);
        }
      }

      for (const id of purge) {
        if (registry.pinnedSessionIds.includes(id)) await registry.unpinSession(id);
        if (registry.archivedSessionIds.includes(id)) await registry.unarchiveSession(id);
      }
    } catch (error) {
      if (filesTouched || deletedLogs.length > 0) {
        throw new RequestError(
          500,
          'PARTIAL_DELETE',
          `session logs were removed but registry cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            deletedSessionIds: [...selectedSet],
            deletedLogs,
            missingLogs,
          },
        );
      }
      throw error;
    }

    for (const id of purge) {
      try {
        ctx.emit('api-session/removed', id);
      } catch (error) {
        ctx.logger.warn(`archive-cleaner: cannot publish removal for ${id}: ${String(error)}`);
      }
    }

    return {
      ok: true,
      workspaceId: workspace.id,
      deleted: [...selectedSet],
      cascaded: [...purge].filter((id) => !selectedSet.has(id)),
      deletedLogs,
      missingLogs,
      warnings,
    };
  }

  ctx.connection.fetch.register({
    path: '/api/archive-cleaner/state',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      try {
        return json(200, await snapshot());
      } catch (error) {
        ctx.logger.warn(`archive-cleaner: state failed: ${String(error)}`);
        return json(500, {
          error: {
            code: 'STATE_FAILED',
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },
  });

  ctx.connection.fetch.register({
    path: '/api/archive-cleaner/delete',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
          throw new RequestError(415, 'INVALID_REQUEST', 'content type must be application/json');
        }
        const declared = Number(request.headers.get('content-length') ?? '0');
        if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
          throw new RequestError(413, 'INVALID_REQUEST', 'request body is too large');
        }
        const text = await request.text();
        if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
          throw new RequestError(413, 'INVALID_REQUEST', 'request body is too large');
        }
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          throw new RequestError(400, 'INVALID_REQUEST', 'request body is not JSON');
        }
        if (body === null || typeof body !== 'object' || !Array.isArray(body.sessionIds)) {
          throw new RequestError(400, 'INVALID_REQUEST', 'sessionIds must be an array');
        }
        return json(200, await remove(body.sessionIds));
      } catch (error) {
        if (error instanceof RequestError) {
          return json(error.status, {
            error: { code: error.code, message: error.message, ...error.details },
          });
        }
        ctx.logger.warn(`archive-cleaner: delete failed: ${String(error)}`);
        return json(500, {
          error: {
            code: 'DELETE_FAILED',
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    },
  });
}
