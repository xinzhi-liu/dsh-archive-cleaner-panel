/**
 * Browser half of the archive-cleaner bundle.
 *
 * One left-sidebar entry opens a panel that lists the default Workspace's
 * archived conversations. Rows are selected individually (or all at once) and
 * a destructive button calls the host route that performs the permanent
 * removal. Titles and timestamps come from the Client Session list; the host
 * remains the authority for workspace membership and archived state.
 */

window.__ModuleLoader__.load({
  id: 'dsh-archive-cleaner-panel',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Sidebar entry id; the main panel registers under the same key. */
    const PANEL_ID = 'archive-cleaner';
    /** Locale namespace owned by this plugin. */
    const NS = 'archive-cleaner';
    /** Host routes. Connection authenticates the browser owner before dispatch. */
    const STATE_URL = '/api/archive-cleaner/state';
    const DELETE_URL = '/api/archive-cleaner/delete';
    /** Keep the body well below the host route's 32 KiB limit. */
    const MAX_SELECTION = 100;

    const zh = {
      panel: '归档清理',
      title: '归档对话清理',
      scope: '默认工作区 · {title}',
      introTitle: '只清理默认工作区里的归档对话',
      introBody: '勾选要彻底删除的已归档对话。删除会移除会话日志、投影缓存、工作区归档记录，以及这些对话派生的子智能体会话日志。',
      pathLabel: '工作区路径',
      refresh: '刷新',
      selectAll: '全选',
      deselectAll: '取消全选',
      selectedCount: '已选 {selected} / {total}',
      selectionLimit: '一次最多选择 {count} 个对话，请分批删除。',
      deleteSelected: '删除选中（{count}）',
      deleting: '正在删除…',
      loading: '正在读取归档对话…',
      refreshing: '正在刷新…',
      noWorkspace: '没有找到默认工作区',
      noWorkspaceBody: '当前 profile 没有可识别的默认工作区，因此没有可清理的归档对话。',
      noArchived: '默认工作区里没有已归档的对话',
      noArchivedBody: '在侧栏归档对话后，它们会出现在这里。',
      loadFailed: '读取归档对话失败',
      retry: '重试',
      archivedBadge: '已归档',
      liveBadge: '仍在内存中',
      liveHint: '删除时会先停止并卸载该对话，然后移除它的日志。',
      untitled: '未命名对话',
      unknownTime: '时间未知',
      confirmTitle: '彻底删除选中的 {count} 个对话？',
      confirmBody: '这会永久移除会话日志目录、投影缓存、工作区归档记录，以及它们派生的子智能体会话日志。仍在内存中的对话会先被停止并卸载。',
      confirmWarning1: '删除后无法恢复，也不会进入回收站。',
      confirmWarning2: '工作区里的普通文件不受影响。',
      warningLabel: '注意',
      cancel: '取消',
      confirmDelete: '彻底删除',
      deleted: '已彻底删除 {count} 个对话。',
      cascaded: '同时清理了 {count} 个子智能体会话日志。',
      warnings: '有 {count} 项附带清理未完成：',
      deleteFailed: '删除失败',
      errorNetwork: '无法连接本机 Harness 服务。',
      errorUnauthorized: '页面登录状态已失效，请刷新页面后重试。',
      errorLive: '无法停止仍在内存中的对话，请重启应用后再试。',
      errorScope: '选中的对话已不在默认工作区的归档列表中，请刷新后重试。',
      errorBackend: '当前存储后端不支持定位会话日志，无法彻底删除。',
      errorPartial: '会话日志已删除，但部分归档记录未能清理。可以重试完成清理。',
      footnote: '只显示默认工作区中的归档对话。删除直接作用于本机磁盘，无法撤销。',
      selectRow: '选择 {title}',
    };

    const en = {
      panel: 'Archive cleaner',
      title: 'Archive cleaner',
      scope: 'Default workspace · {title}',
      introTitle: 'Clean up archived conversations in the default workspace',
      introBody: 'Select archived conversations to remove permanently. Deleting removes the session log, projection cache, archive record, and any subagent session logs derived from the conversation.',
      pathLabel: 'Workspace path',
      refresh: 'Refresh',
      selectAll: 'Select all',
      deselectAll: 'Clear selection',
      selectedCount: '{selected} of {total} selected',
      selectionLimit: 'Select at most {count} conversations at a time and delete them in batches.',
      deleteSelected: 'Delete selected ({count})',
      deleting: 'Deleting…',
      loading: 'Reading archived conversations…',
      refreshing: 'Refreshing…',
      noWorkspace: 'No default workspace found',
      noWorkspaceBody: 'This profile has no identifiable default workspace, so there are no archived conversations to clean up.',
      noArchived: 'No archived conversations in the default workspace',
      noArchivedBody: 'Archive a conversation from the sidebar and it will appear here.',
      loadFailed: 'Could not read archived conversations',
      retry: 'Retry',
      archivedBadge: 'Archived',
      liveBadge: 'In memory',
      liveHint: 'Deleting stops and unloads this conversation before removing its log.',
      untitled: 'Untitled conversation',
      unknownTime: 'Unknown time',
      confirmTitle: 'Permanently delete {count} selected conversation(s)?',
      confirmBody: 'This permanently removes the session log directory, projection cache, workspace archive record, and any subagent session logs derived from them. Conversations still in memory are stopped and unloaded first.',
      confirmWarning1: 'Permanent deletion. No recycle bin.',
      confirmWarning2: 'Workspace files are untouched.',
      warningLabel: 'CAUTION',
      cancel: 'Cancel',
      confirmDelete: 'Delete permanently',
      deleted: 'Permanently deleted {count} conversation(s).',
      cascaded: 'Also removed {count} subagent session log(s).',
      warnings: '{count} related cleanup step(s) did not finish:',
      deleteFailed: 'Delete failed',
      errorNetwork: 'Could not reach the local Harness service.',
      errorUnauthorized: 'The page session has expired. Refresh the page and try again.',
      errorLive: 'The live conversation could not be stopped. Restart the app and try again.',
      errorScope: 'A selected conversation is no longer archived in the default workspace. Refresh and try again.',
      errorBackend: 'The current storage backend does not expose session log locations, so it cannot be deleted permanently.',
      errorPartial: 'Session logs were deleted, but some archive records could not be cleaned up. Retry to finish the cleanup.',
      footnote: 'Only archived conversations in the default workspace are shown. Deleting acts directly on local disk and cannot be undone.',
      selectRow: 'Select {title}',
    };

    const CSS = `
.aclm-page{--aclm-danger:var(--dsw-alias-state-error-primary,#d95c5c);--aclm-success:var(--dsw-alias-state-success-primary,#3f9d63);--aclm-green:var(--dsw-alias-state-success-primary,#169c5b);--aclm-ink:var(--dsw-alias-label-primary,#1f2328);--aclm-muted:var(--dsw-alias-label-secondary,#6b7280);--aclm-faint:var(--dsw-alias-label-tertiary,#9ca3af);--aclm-rule:var(--dsw-alias-border-l1,rgba(127,127,127,.22));--aclm-hover:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.09));--aclm-brand:var(--dsw-alias-brand-primary,#4d6bfe);flex:1 1 auto;width:100%;max-width:100%;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base,#fff);color:var(--aclm-ink)}
.aclm-header{flex:none;display:flex;align-items:center;gap:8px;height:52px;padding:0 20px;box-sizing:border-box;border-bottom:.5px solid var(--aclm-rule)}
.aclm-headerGlyph{display:inline-flex;align-items:center;color:var(--aclm-green)}
.aclm-title{margin:0;font-size:14px;font-weight:600;line-height:1.4;white-space:nowrap}
.aclm-scope{margin-left:8px;min-width:0;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--aclm-faint)}
.aclm-iconButton{appearance:none;flex:none;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;margin-left:4px;padding:0;border:none;border-radius:8px;background:transparent;color:var(--aclm-muted);cursor:pointer}
.aclm-iconButton:hover:not(:disabled){background:var(--aclm-hover);color:var(--aclm-ink)}
.aclm-iconButton:disabled{opacity:.45;cursor:default}
.aclm-iconButton:focus-visible,.aclm-button:focus-visible,.aclm-row:focus-within,.aclm-checkAll:focus-within{outline:2px solid var(--aclm-brand);outline-offset:2px}
.aclm-body{flex:1 1 auto;width:100%;min-width:0;min-height:0;overflow:auto;padding:22px 20px 30px;box-sizing:border-box}
.aclm-stack{width:100%;max-width:780px;min-width:0;margin:0;display:flex;flex-direction:column;gap:16px}
.aclm-intro{min-width:0;border:.5px solid var(--aclm-rule);border-radius:14px;padding:18px 20px;background:linear-gradient(135deg,color-mix(in srgb,var(--aclm-brand) 7%,transparent),transparent 62%),color-mix(in srgb,var(--aclm-muted) 3%,transparent)}
.aclm-introTitle{margin:0 0 6px;font-size:14px;font-weight:600;line-height:1.45}
.aclm-introText{margin:0;font-size:13px;line-height:1.65;color:var(--aclm-muted);overflow-wrap:anywhere}
.aclm-pathRow{display:flex;align-items:center;gap:8px;margin-top:12px;min-width:0;max-width:100%}
.aclm-pathLabel{flex:none;font-size:11px;letter-spacing:.03em;text-transform:uppercase;color:var(--aclm-faint)}
.aclm-path{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:11.5px;color:var(--aclm-muted)}
.aclm-toolbar{display:flex;align-items:center;gap:12px;min-height:38px;flex-wrap:wrap}
.aclm-checkAll{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--aclm-muted);cursor:pointer;user-select:none}
.aclm-count{font-size:12px;color:var(--aclm-faint);white-space:nowrap}
.aclm-button{appearance:none;border:none;border-radius:9px;height:34px;padding:0 14px;font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:filter .15s ease,background .15s ease,color .15s ease,transform .1s ease;white-space:nowrap}
.aclm-button:active:not(:disabled){transform:scale(.985)}
.aclm-button:disabled{opacity:.45;cursor:default}
.aclm-primary{background:var(--aclm-danger);color:#fff}
.aclm-primary:hover:not(:disabled){filter:brightness(1.06)}
.aclm-secondary{background:transparent;color:var(--aclm-muted);border:.5px solid var(--aclm-rule)}
.aclm-secondary:hover:not(:disabled){background:var(--aclm-hover);color:var(--aclm-ink)}
.aclm-toolbar .aclm-button{margin-left:0}
.aclm-check{appearance:none;flex:none;width:17px;height:17px;margin:0;border:1.5px solid color-mix(in srgb,var(--aclm-muted) 55%,transparent);border-radius:5px;background:transparent;cursor:pointer;display:inline-grid;place-content:center;transition:background .12s ease,border-color .12s ease}
.aclm-check::after{content:'';width:8px;height:4.5px;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg) translateY(-.5px) scale(0);transition:transform .12s ease}
.aclm-check:checked{background:var(--aclm-brand);border-color:var(--aclm-brand)}
.aclm-check:checked::after{transform:rotate(-45deg) translateY(-.5px) scale(1)}
.aclm-check:disabled{background:color-mix(in srgb,var(--aclm-muted) 16%,transparent);border-color:transparent;cursor:default}
.aclm-check:disabled::after{display:none}
.aclm-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.aclm-row{display:flex;align-items:flex-start;gap:12px;padding:13px 14px;border:.5px solid var(--aclm-rule);border-radius:12px;background:transparent;cursor:pointer;transition:background .12s ease,border-color .12s ease}
.aclm-row:hover{background:var(--aclm-hover)}
.aclm-rowSelected{border-color:color-mix(in srgb,var(--aclm-brand) 52%,var(--aclm-rule));background:color-mix(in srgb,var(--aclm-brand) 6%,transparent)}
.aclm-rowSelected:hover{background:color-mix(in srgb,var(--aclm-brand) 9%,transparent)}
.aclm-rowBody{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:5px}
.aclm-rowTop{display:flex;align-items:center;gap:8px;min-width:0}
.aclm-rowTitle{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13.5px;line-height:1.45;font-weight:500}
.aclm-badge{flex:none;display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:999px;font-size:10.5px;line-height:1;letter-spacing:.02em;color:var(--aclm-faint);background:color-mix(in srgb,var(--aclm-muted) 10%,transparent)}
.aclm-badgeLive{color:var(--aclm-danger);background:color-mix(in srgb,var(--aclm-danger) 12%,transparent)}
.aclm-rowMeta{display:flex;align-items:center;gap:7px;min-width:0;font-size:11.5px;color:var(--aclm-faint);white-space:nowrap;overflow:hidden}
.aclm-rowMeta code{min-width:0;overflow:hidden;text-overflow:ellipsis;font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',monospace;font-size:10.5px}
.aclm-dot{opacity:.55}
.aclm-empty{border:.5px dashed var(--aclm-rule);border-radius:14px;padding:34px 22px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.aclm-emptyIcon{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;color:var(--aclm-green);background:color-mix(in srgb,var(--aclm-green) 10%,transparent)}
.aclm-emptyTitle{margin:4px 0 0;font-size:13.5px;font-weight:600}
.aclm-emptyText{margin:0;max-width:420px;font-size:12.5px;line-height:1.6;color:var(--aclm-muted)}
.aclm-empty .aclm-button{margin-top:6px}
.aclm-skeleton{display:flex;flex-direction:column;gap:8px}
.aclm-skeletonRow{height:62px;border:.5px solid var(--aclm-rule);border-radius:12px;background:linear-gradient(90deg,color-mix(in srgb,var(--aclm-muted) 8%,transparent),color-mix(in srgb,var(--aclm-muted) 3%,transparent),color-mix(in srgb,var(--aclm-muted) 8%,transparent));background-size:200% 100%;animation:aclm-shimmer 1.4s ease infinite}
@keyframes aclm-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}
@media (prefers-reduced-motion:reduce){.aclm-skeletonRow{animation:none}}
.aclm-errorCard{border:.5px solid color-mix(in srgb,var(--aclm-danger) 32%,var(--aclm-rule));background:color-mix(in srgb,var(--aclm-danger) 5%,transparent);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:8px}
.aclm-errorTitle{font-size:13px;font-weight:600;color:var(--aclm-danger)}
.aclm-errorText{font-size:12.5px;line-height:1.6;color:var(--aclm-muted);word-break:break-word}
.aclm-notice{display:flex;align-items:flex-start;gap:10px;border:.5px solid var(--aclm-rule);border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.55}
.aclm-noticeSuccess{border-color:color-mix(in srgb,var(--aclm-success) 34%,var(--aclm-rule));background:color-mix(in srgb,var(--aclm-success) 6%,transparent)}
.aclm-noticeError{border-color:color-mix(in srgb,var(--aclm-danger) 34%,var(--aclm-rule));background:color-mix(in srgb,var(--aclm-danger) 6%,transparent)}
.aclm-noticeIcon{flex:none;display:inline-flex;margin-top:1px}
.aclm-noticeSuccess .aclm-noticeIcon{color:var(--aclm-success)}
.aclm-noticeError .aclm-noticeIcon{color:var(--aclm-danger)}
.aclm-noticeBody{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px}
.aclm-noticeDetail{color:var(--aclm-muted);word-break:break-word}
.aclm-noticeList{margin:0;padding-left:16px;color:var(--aclm-muted);word-break:break-word}
.aclm-noticeClose{appearance:none;flex:none;border:none;background:transparent;color:var(--aclm-faint);font:inherit;font-size:16px;line-height:1;padding:2px 4px;border-radius:5px;cursor:pointer}
.aclm-noticeClose:hover{color:var(--aclm-ink);background:var(--aclm-hover)}
.aclm-footnote{margin:2px 0 0;font-size:11.5px;line-height:1.6;color:var(--aclm-faint)}
.aclm-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(15,18,24,.42);backdrop-filter:blur(2px)}
.aclm-dialog{width:100%;max-width:430px;box-sizing:border-box;border-radius:16px;padding:22px;background:var(--dsw-alias-bg-elevated,var(--dsw-alias-bg-base,#fff));color:var(--aclm-ink);border:.5px solid var(--aclm-rule);box-shadow:0 24px 70px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:12px}
.aclm-dialogIcon{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:11px;color:var(--aclm-green);background:color-mix(in srgb,var(--aclm-green) 11%,transparent)}
.aclm-dialogTitle{margin:0;font-size:16px;line-height:1.45;font-weight:600}
.aclm-dialogText{margin:0;font-size:13px;line-height:1.65;color:var(--aclm-muted)}
.aclm-dialogWarning{display:flex;align-items:center;gap:12px;border-radius:9px;padding:10px 12px;color:var(--aclm-danger);background:color-mix(in srgb,var(--aclm-danger) 7%,transparent)}
.aclm-warningMark{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:var(--aclm-danger);line-height:1}
.aclm-warningLabel{font-size:14px;font-weight:800;line-height:1;letter-spacing:.08em;text-indent:.08em;white-space:nowrap}
.aclm-warningText{flex:1 1 auto;min-width:0;margin:0;font-size:12.5px;line-height:1.6;font-weight:700;letter-spacing:.01em}
.aclm-dialogActions{display:flex;justify-content:center;gap:10px;margin-top:4px}
@media (max-width:620px){.aclm-header{padding:0 14px}.aclm-body{padding:16px 14px 24px}.aclm-scope{display:none}.aclm-toolbar{flex-wrap:wrap}.aclm-toolbar .aclm-button{margin-left:0;width:100%}.aclm-row{padding:12px}.aclm-dialog{padding:18px}}
`;

    /**
     * Replace `{name}` placeholders when the slot exposes no translator.
     * @param template - dictionary entry.
     * @param params - placeholder values.
     * @returns the formatted text.
     */
    function fill(template, params) {
      return String(template).replace(/\{(\w+)\}/g, (match, name) =>
        params !== undefined && Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
    }

    /**
     * Build the panel translator, preferring the slot-provided one.
     * @param t - translator supplied by the slot's `locale` option.
     * @returns a `(key, params) => string` translator.
     */
    function translator(t) {
      if (typeof t === 'function') return t;
      return (key, params) => fill(zh[key] === undefined ? key : zh[key], params);
    }

    /**
     * Subscribe to one Client snapshot store.
     * @param store - `{ getSnapshot, subscribe }`.
     * @returns the latest snapshot.
     */
    function useStore(store) {
      const subscribe = React.useCallback((listener) => store.subscribe(listener), [store]);
      const getSnapshot = React.useCallback(() => store.getSnapshot(), [store]);
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    }

    /**
     * Short, readable suffix for a Session id.
     * @param id - full Session id.
     * @returns the suffix used in a row.
     */
    function shortId(id) {
      return String(id).replace(/^session-/, '').slice(0, 8);
    }

    /**
     * Format a millisecond timestamp for the current locale.
     * @param value - epoch milliseconds.
     * @param fallback - text for an absent or invalid timestamp.
     * @returns formatted date/time.
     */
    function formatWhen(value, fallback) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return fallback;
      try {
        return new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date);
      } catch (error) {
        return date.toLocaleString();
      }
    }

    /** One failure with a stable code from the host or transport layer. */
    class ApiError extends Error {
      /**
       * @param code - stable code.
       * @param message - diagnostic message.
       * @param details - structured host details.
       */
      constructor(code, message, details = {}) {
        super(message);
        this.name = 'ArchiveCleanerApiError';
        this.code = code;
        this.details = details;
      }
    }

    /**
     * Fetch one JSON response and normalize failures.
     * @param url - exact route.
     * @param init - fetch options.
     * @returns parsed JSON body.
     */
    async function requestJson(url, init) {
      let response;
      try {
        response = await fetch(url, {
          credentials: 'same-origin',
          cache: 'no-store',
          ...init,
          headers: {
            accept: 'application/json',
            ...(init?.headers ?? {}),
          },
        });
      } catch (error) {
        throw new ApiError('NETWORK', error instanceof Error ? error.message : String(error));
      }
      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        // A missing route returns HTML or an empty body; the status below is
        // still the useful diagnostic.
      }
      if (!response.ok) {
        const hostError = body !== null && typeof body === 'object' ? body.error : undefined;
        throw new ApiError(
          hostError !== undefined && typeof hostError.code === 'string'
            ? hostError.code
            : response.status === 401 || response.status === 403 ? 'UNAUTHORIZED' : `HTTP_${response.status}`,
          hostError !== undefined && typeof hostError.message === 'string'
            ? hostError.message
            : `HTTP ${response.status}`,
          hostError !== undefined && typeof hostError === 'object' ? hostError : {},
        );
      }
      return body;
    }

    /**
     * Build the data/actions the mounted page needs from the Client Context.
     * @param ctx - Client root context.
     * @returns the page API.
     */
    function createApi(ctx) {
      return {
        sessionsList: ctx.sessions.list,
        workspacesList: ctx.workspaces.list,
        async state(signal) {
          const body = await requestJson(STATE_URL, { signal });
          if (body === null || typeof body !== 'object' || !Array.isArray(body.rows)) {
            throw new ApiError('BAD_STATE', 'state response is missing rows');
          }
          return body;
        },
        async remove(ids, signal) {
          const body = await requestJson(DELETE_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionIds: ids }),
            signal,
          });
          if (body === null || typeof body !== 'object' || body.ok !== true) {
            throw new ApiError('BAD_RESULT', 'delete response did not confirm success');
          }
          return body;
        },
      };
    }

    /**
     * Accepted green cleanup glyph variants. Keep the chosen variant in
     * `ICON_VARIANT`; the five candidates are rendered in the option sheet
     * shown to the user.
     */
    const ICON_PATHS = {
      a: [
        'M4.5 7h15',
        'M9.5 7V4.5h5V7',
        'M6.8 7l.7 12.2h9L17.2 7',
        'M10.2 10.8v5.2',
        'M13.8 10.8v5.2',
      ],
      b: [
        'M4.5 7h15',
        'M9.5 7V4.5h5V7',
        'M6.8 7l.7 12.2h9L17.2 7',
        'M10.2 10.8a2.4 2.4 0 0 1 4.1-1.2',
        'M14.3 9.6v2.1h-2.1',
        'M13.8 14.3a2.4 2.4 0 0 1-4.1 1.2',
        'M9.7 15.5v-2.1h2.1',
      ],
      c: [
        'M12 3.2 19.2 6v5.4c0 4.4-2.9 7.5-7.2 9.4-4.3-1.9-7.2-5-7.2-9.4V6L12 3.2Z',
        'M8.7 12.1l2.2 2.2 4.4-4.5',
      ],
      d: [
        'M4.5 7.5h15v11h-15z',
        'M3.5 4.5h17v3h-17z',
        'M9.5 11.5h5',
        'M10.2 15.2l3.6 2.6',
        'M13.8 15.2l-3.6 2.6',
      ],
      e: [
        'M14.6 4.2 19.8 9.4',
        'M12.6 6.2l5.2 5.2-2.1 2.1-5.2-5.2z',
        'M10.6 8.3 4.2 14.7v3.5h3.5l6.4-6.4',
        'M4.2 18.2h3.5',
      ],
    };

    /** Chosen green glyph; change this single key after the user picks one. */
    const ICON_VARIANT = 'd';

    /**
     * Green cleanup glyph used by the sidebar entry, the page header, the
     * empty state, and the confirmation dialog.
     * @param props - optional `size`, `active`, and `variant`.
     * @returns the icon element.
     */
    function CleanupIcon({ size, active, variant }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16;
      const paths = ICON_PATHS[variant ?? ICON_VARIANT] ?? ICON_PATHS.a;
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: active === true ? 1.9 : 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        style: {
          display: 'block',
          color: 'var(--dsw-alias-state-success-primary, #169c5b)',
        },
      }, paths.map((d, index) => h('path', { key: String(index), d })));
    }

    /**
     * Filled red danger triangle with a white exclamation mark. The dialog
     * pairs it with the bold "CAUTION / 注意" label below.
     * @param props - optional `size`.
     * @returns the icon element.
     */
    function WarningIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 22;
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      },
      h('path', {
        d: 'M12 2.8 22 20.2H2L12 2.8Z',
        fill: 'currentColor',
        stroke: 'currentColor',
        strokeWidth: 1.2,
        strokeLinejoin: 'round',
      }),
      h('path', {
        d: 'M12 8.2v5.6',
        stroke: '#fff',
        strokeWidth: 2.2,
        strokeLinecap: 'round',
      }),
      h('circle', { cx: 12, cy: 17.1, r: 1.25, fill: '#fff' }));
    }

    /**
     * Refresh glyph for the header button.
     * @param props - optional `size`.
     * @returns the icon element.
     */
    function RefreshIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16;
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      },
      h('path', { d: 'M20 6.5v5h-5' }),
      h('path', { d: 'M4 17.5v-5h5' }),
      h('path', { d: 'M6.1 9.2a5.3 5.3 0 0 1 8.7-2.5L20 11.5' }),
      h('path', { d: 'M17.9 14.8a5.3 5.3 0 0 1-8.7 2.5L4 12.5' }));
    }

    /** Small check glyph for the success notice. */
    function CheckIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16;
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      },
      h('path', { d: 'm5 12.5 4.4 4.4L19 6.8' }));
    }

    /** Small warning glyph for the error notice. */
    function WarnIcon({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 16;
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      },
      h('path', { d: 'M12 3.6 21 20H3L12 3.6Z' }),
      h('path', { d: 'M12 9.2v4.4' }),
      h('path', { d: 'M12 17h.01' }));
    }

    /**
     * The archived-session panel.
     * @param props - `api` injected by the registration, `t` from the locale seat.
     * @returns the page element.
     */
    function ArchivePage({ api, t }) {
      const text = translator(t);
      const [state, setState] = React.useState({ phase: 'loading', rows: [], workspace: null, error: null });
      const [selected, setSelected] = React.useState(() => new Set());
      const [hidden, setHidden] = React.useState(() => new Set());
      const [confirmOpen, setConfirmOpen] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [refreshing, setRefreshing] = React.useState(false);
      const [notice, setNotice] = React.useState(null);
      const requestSeq = React.useRef(0);

      const sessionsSnapshot = useStore(api.sessionsList) ?? {};
      const workspacesSnapshot = useStore(api.workspacesList);

      const load = React.useCallback(async (quiet) => {
        const seq = ++requestSeq.current;
        if (quiet) setRefreshing(true);
        setState((previous) => ({
          ...previous,
          phase: quiet && previous.rows.length > 0 ? 'ready' : 'loading',
          error: null,
        }));
        try {
          const body = await api.state();
          if (seq !== requestSeq.current) return;
          setState({
            phase: 'ready',
            rows: body.rows,
            workspace: body.workspace ?? null,
            error: null,
          });
        } catch (error) {
          if (seq !== requestSeq.current) return;
          setState((previous) => ({
            ...previous,
            phase: previous.rows.length > 0 ? 'ready' : 'error',
            error,
          }));
        } finally {
          if (seq === requestSeq.current) setRefreshing(false);
        }
      }, [api]);

      React.useEffect(() => {
        void load(false);
      }, [load]);

      // Archiving, restoring, or deleting elsewhere changes the Workspace
      // snapshot; refresh after the host's follow frame lands.
      React.useEffect(() => {
        const timer = window.setTimeout(() => {
          void load(true);
        }, 220);
        return () => window.clearTimeout(timer);
      }, [workspacesSnapshot, load]);

      const summaryById = sessionsSnapshot.byId ?? {};
      const visibleRows = React.useMemo(() => {
        const archivedRows = state.rows
          .filter((row) => !hidden.has(row.id))
          .map((row) => {
            const summary = summaryById[row.id];
            return {
              ...row,
              title: summary?.displayTitle || summary?.title || '',
              updatedAt: typeof summary?.updatedAt === 'number' ? summary.updatedAt : row.createdAt,
            };
          });
        archivedRows.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
        return archivedRows;
      }, [state.rows, hidden, summaryById]);

      const rowIds = visibleRows.map((row) => row.id).join('\n');
      React.useEffect(() => {
        setSelected((previous) => {
          if (previous.size === 0) return previous;
          const selectable = new Set(visibleRows.map((row) => row.id));
          const next = new Set([...previous].filter((id) => selectable.has(id)));
          if (next.size === previous.size) return previous;
          return next;
        });
      }, [rowIds]);

      React.useEffect(() => {
        if (!confirmOpen) return undefined;
        const onKeyDown = (event) => {
          if (event.key === 'Escape' && !busy) setConfirmOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
      }, [confirmOpen, busy]);

      const selectableRows = visibleRows;
      const limitedRows = selectableRows.slice(0, MAX_SELECTION);
      const allSelected = limitedRows.length > 0 && limitedRows.every((row) => selected.has(row.id));
      const selectedCount = selected.size;

      const toggleAll = () => {
        setSelected(allSelected ? new Set() : new Set(limitedRows.map((row) => row.id)));
      };

      const toggleOne = (id) => {
        if (!selected.has(id) && selected.size >= MAX_SELECTION) {
          setNotice({
            kind: 'error',
            title: text('selectionLimit', { count: MAX_SELECTION }),
            detail: '',
            warnings: [],
          });
          return;
        }
        setSelected((previous) => {
          const next = new Set(previous);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      };

      const messageFor = (error) => {
        if (!(error instanceof ApiError)) return error instanceof Error ? error.message : String(error);
        switch (error.code) {
          case 'NETWORK': return text('errorNetwork');
          case 'UNAUTHORIZED': return text('errorUnauthorized');
          case 'SESSION_LIVE': return text('errorLive');
          case 'NOT_ARCHIVED_IN_DEFAULT_WORKSPACE':
          case 'NOT_ARCHIVED':
            return text('errorScope');
          case 'UNSUPPORTED_BACKEND': return text('errorBackend');
          case 'PARTIAL_DELETE': return text('errorPartial');
          default: return error.message || text('deleteFailed');
        }
      };

      const handleDelete = async () => {
        if (busy || selected.size === 0) return;
        const ids = [...selected].slice(0, MAX_SELECTION);
        setBusy(true);
        setNotice(null);
        try {
          const body = await api.remove(ids);
          const deleted = Array.isArray(body.deleted) ? body.deleted : ids;
          const cascaded = Array.isArray(body.cascaded) ? body.cascaded : [];
          const warnings = Array.isArray(body.warnings) ? body.warnings.filter((item) => typeof item === 'string') : [];
          setHidden((previous) => {
            const next = new Set(previous);
            for (const id of deleted) next.add(id);
            return next;
          });
          setSelected(new Set());
          setConfirmOpen(false);
          setNotice({
            kind: 'success',
            title: text('deleted', { count: deleted.length }),
            detail: cascaded.length > 0 ? text('cascaded', { count: cascaded.length }) : '',
            warnings,
          });
          void load(true);
        } catch (error) {
          setConfirmOpen(false);
          setNotice({ kind: 'error', title: text('deleteFailed'), detail: messageFor(error), warnings: [] });
        } finally {
          setBusy(false);
        }
      };

      const workspace = state.workspace;
      const hasRows = visibleRows.length > 0;
      const titleOf = (row) => row.title || text('untitled');

      const rows = visibleRows.map((row) => h('label', {
        key: row.id,
        className: 'aclm-row' + (selected.has(row.id) ? ' aclm-rowSelected' : ''),
        title: row.live ? text('liveHint') : titleOf(row),
      },
      h('input', {
        type: 'checkbox',
        className: 'aclm-check',
        checked: selected.has(row.id),
        disabled: busy,
        onChange: () => toggleOne(row.id),
        'aria-label': text('selectRow', { title: titleOf(row) }),
      }),
      h('div', { className: 'aclm-rowBody' },
        h('div', { className: 'aclm-rowTop' },
          h('span', { className: 'aclm-rowTitle' }, titleOf(row)),
          h('span', {
            className: 'aclm-badge' + (row.live ? ' aclm-badgeLive' : ''),
          }, row.live ? text('liveBadge') : text('archivedBadge'))),
        h('div', { className: 'aclm-rowMeta' },
          h('span', null, formatWhen(row.updatedAt, text('unknownTime'))),
          h('span', { className: 'aclm-dot', 'aria-hidden': 'true' }, '·'),
          h('code', { title: row.id }, shortId(row.id))))));

      return h(React.Fragment, null,
        h('style', null, CSS),
        h('div', { className: 'aclm-page' },
          h('header', { className: 'aclm-header' },
            h('span', { className: 'aclm-headerGlyph' }, h(CleanupIcon, { size: 16 })),
            h('h1', { className: 'aclm-title' }, text('title')),
            workspace !== null
              ? h('span', { className: 'aclm-scope' }, text('scope', { title: workspace.title }))
              : null,
            h('button', {
              type: 'button',
              className: 'aclm-iconButton',
              onClick: () => { void load(true); },
              disabled: refreshing || busy,
              title: text('refresh'),
              'aria-label': text('refresh'),
            }, h(RefreshIcon, { size: 15 }))),
          h('div', { className: 'aclm-body' },
            h('div', { className: 'aclm-stack' },
              h('section', { className: 'aclm-intro' },
                h('h2', { className: 'aclm-introTitle' }, text('introTitle')),
                h('p', { className: 'aclm-introText' }, text('introBody')),
                workspace !== null
                  ? h('div', { className: 'aclm-pathRow' },
                    h('span', { className: 'aclm-pathLabel' }, text('pathLabel')),
                    h('code', { className: 'aclm-path', title: workspace.path }, workspace.path))
                  : null),

              state.error !== null && hasRows
                ? h('div', { className: 'aclm-notice aclm-noticeError', role: 'alert' },
                  h('span', { className: 'aclm-noticeIcon' }, h(WarnIcon, { size: 15 })),
                  h('div', { className: 'aclm-noticeBody' },
                    h('span', null, text('loadFailed')),
                    h('span', { className: 'aclm-noticeDetail' }, messageFor(state.error))))
                : null,

              notice !== null
                ? h('div', {
                  className: 'aclm-notice ' + (notice.kind === 'success' ? 'aclm-noticeSuccess' : 'aclm-noticeError'),
                  role: notice.kind === 'success' ? 'status' : 'alert',
                },
                h('span', { className: 'aclm-noticeIcon' },
                  notice.kind === 'success' ? h(CheckIcon, { size: 15 }) : h(WarnIcon, { size: 15 })),
                h('div', { className: 'aclm-noticeBody' },
                  h('span', null, notice.title),
                  notice.detail !== '' ? h('span', { className: 'aclm-noticeDetail' }, notice.detail) : null,
                  notice.warnings.length > 0
                    ? h(React.Fragment, null,
                      h('span', { className: 'aclm-noticeDetail' }, text('warnings', { count: notice.warnings.length })),
                      h('ul', { className: 'aclm-noticeList' },
                        notice.warnings.map((warning, index) => h('li', { key: String(index) }, warning))))
                    : null),
                h('button', {
                  type: 'button',
                  className: 'aclm-noticeClose',
                  onClick: () => setNotice(null),
                  'aria-label': text('cancel'),
                }, '×'))
                : null,

              hasRows
                ? h('div', { className: 'aclm-toolbar' },
                  h('label', { className: 'aclm-checkAll' },
                    h('input', {
                      type: 'checkbox',
                      className: 'aclm-check',
                      checked: allSelected,
                      disabled: busy || selectableRows.length === 0,
                      onChange: toggleAll,
                    }),
                    h('span', null, allSelected ? text('deselectAll') : text('selectAll'))),
                  h('span', { className: 'aclm-count' }, text('selectedCount', { selected: selectedCount, total: visibleRows.length })),
                  h('button', {
                    type: 'button',
                    className: 'aclm-button aclm-primary',
                    disabled: busy || selectedCount === 0,
                    onClick: () => setConfirmOpen(true),
                  }, busy ? text('deleting') : text('deleteSelected', { count: selectedCount })))
                : null,

              state.phase === 'loading' && !hasRows
                ? h('div', { className: 'aclm-skeleton', 'aria-label': text('loading') },
                  h('div', { className: 'aclm-skeletonRow' }),
                  h('div', { className: 'aclm-skeletonRow' }),
                  h('div', { className: 'aclm-skeletonRow' }))
                : null,

              state.phase === 'error'
                ? h('div', { className: 'aclm-errorCard' },
                  h('span', { className: 'aclm-errorTitle' }, text('loadFailed')),
                  h('span', { className: 'aclm-errorText' }, messageFor(state.error)),
                  h('div', null,
                    h('button', {
                      type: 'button',
                      className: 'aclm-button aclm-secondary',
                      onClick: () => { void load(false); },
                    }, text('retry'))))
                : null,

              state.phase === 'ready' && !hasRows
                ? h('div', { className: 'aclm-empty' },
                  h('span', { className: 'aclm-emptyIcon' }, h(CleanupIcon, { size: 22 })),
                  h('h2', { className: 'aclm-emptyTitle' }, workspace === null ? text('noWorkspace') : text('noArchived')),
                  h('p', { className: 'aclm-emptyText' }, workspace === null ? text('noWorkspaceBody') : text('noArchivedBody')))
                : null,

              hasRows
                ? h('ul', { className: 'aclm-list' }, rows)
                : null,

              h('p', { className: 'aclm-footnote' }, text('footnote')))),

          confirmOpen
            ? h('div', {
              className: 'aclm-overlay',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget && !busy) setConfirmOpen(false);
              },
            },
            h('div', {
              className: 'aclm-dialog',
              role: 'dialog',
              'aria-modal': 'true',
              'aria-labelledby': 'aclm-confirm-title',
            },
            h('span', { className: 'aclm-dialogIcon' }, h(CleanupIcon, { size: 21 })),
            h('h2', { className: 'aclm-dialogTitle', id: 'aclm-confirm-title' },
              text('confirmTitle', { count: selectedCount })),
            h('p', { className: 'aclm-dialogText' }, text('confirmBody')),
            h('div', { className: 'aclm-dialogWarning' },
              h('div', { className: 'aclm-warningMark', 'aria-hidden': 'true' },
                h(WarningIcon, { size: 23 }),
                h('span', { className: 'aclm-warningLabel' }, text('warningLabel'))),
              h('strong', { className: 'aclm-warningText' },
                text('confirmWarning1'),
                h('br'),
                text('confirmWarning2'))),
            h('div', { className: 'aclm-dialogActions' },
              h('button', {
                type: 'button',
                className: 'aclm-button aclm-secondary',
                disabled: busy,
                autoFocus: true,
                onClick: () => setConfirmOpen(false),
              }, text('cancel')),
              h('button', {
                type: 'button',
                className: 'aclm-button aclm-primary',
                disabled: busy,
                onClick: () => { void handleDelete(); },
              }, busy ? text('deleting') : text('confirmDelete')))))
            : null));
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'workspaces'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'archive-cleaner: dictionaries');
        const t = ctx.locale.bind(NS);
        const api = createApi(ctx);

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 21,
          locale: NS,
          label: () => t('panel'),
        }, CleanupIcon));

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ api }),
        }, ArchivePage));
      },
    };
  },
});
