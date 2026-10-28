# Archive Cleaner

A DSH Web plugin that lists archived conversations in the **default workspace** and permanently deletes the selected ones.

![Confirmation dialog](docs/dialog.png)

## Features

- Sidebar entry and a panel scoped to the default workspace.
- Per-row selection, select all, and a destructive action with confirmation.
- Removes the session log directory, projection cache, workspace archive/accounting records, and subagent session logs derived from the selection.
- Stops and unloads archived sessions that are still in memory before deleting files.
- Removes the rows from the Client list so they do not reappear under Ungrouped.

## Install

```sh
dsh plugin --profile web add github:xinzhi-liu/dsh-archive-cleaner-panel
```

On Desktop, install the same GitHub address from the in-app plugin manager, then refresh the page.

## Safety

- Only archived sessions in the default workspace are accepted.
- The Host re-checks archive state and workspace membership; client-supplied paths are never trusted.
- The delete path must sit under the session storage root and its directory name must equal the Session id.
- Deletion is permanent and does not use a recycle bin. Ordinary workspace files are untouched.

## License

MIT
