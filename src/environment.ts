// Note: This file has now become devoid of all references to values deduced from the remote process - all those now live in the `environment-remote.js` file

import { existsSync } from 'node:fs';
import { arch, release } from 'node:os';
import { dirname, join } from 'node:path';

export const isMac = process.platform === 'darwin';
export const isWindows = process.platform === 'win32';
export const isLinux = process.platform === 'linux';

// A 'FerdiumAppData' folder next to the executable marks a portable
// installation that runs in place (e.g. the zip distribution extracted onto a
// removable drive). The portable installer build signals itself via the
// PORTABLE_EXECUTABLE_FILE environment variable instead.
const hasPortableMarkerFolder = (): boolean => {
  try {
    return existsSync(join(dirname(process.execPath), 'FerdiumAppData'));
  } catch {
    return false;
  }
};

export const isWinPortable =
  process.env.PORTABLE_EXECUTABLE_FILE != null ||
  (isWindows && hasPortableMarkerFolder());

export const isWayland = isLinux && process.env.XDG_SESSION_TYPE === 'wayland';
export const isSnap = isLinux && process.env.SNAP != null;

export const electronVersion: string = process.versions.electron ?? '';
export const chromeVersion: string = process.versions.chrome ?? '';
export const nodeVersion: string = process.versions.node;

export const osArch: string = arch();
export const osRelease: string = release();
export const is64Bit: RegExpMatchArray | null = osArch.match(/64/);

// for accelerator, show the shortform that electron/OS understands
// for tooltip, show symbol
const ctrlKey: string = isMac ? '⌘' : 'Ctrl';
const cmdKey: string = isMac ? 'Cmd' : 'Ctrl';

export const altKey = (isAccelerator = true) =>
  !isAccelerator && isMac ? '⌥' : 'Alt';
export const shiftKey = (isAccelerator = true) =>
  !isAccelerator && isMac ? '⇧' : 'Shift';

// Platform specific shortcut keys
export const cmdOrCtrlShortcutKey = (isAccelerator = true) =>
  isAccelerator ? cmdKey : ctrlKey;
export const lockFerdiumShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+${shiftKey(isAccelerator)}+L`;
export const todosToggleShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+T`;
export const workspaceToggleShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+D`;
export const muteFerdiumShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+${shiftKey(isAccelerator)}+M`;
export const addNewServiceShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+N`;
export const splitModeToggleShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+${altKey(isAccelerator)}+S`;
export const settingsShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+${isMac ? ',' : 'P'}`;
export const downloadsShortcutKey = (isAccelerator = true) =>
  `${cmdOrCtrlShortcutKey(isAccelerator)}+J`;
export const toggleFullScreenKey = () =>
  isMac ? `CTRL + ${cmdKey} + F` : 'F11';
