// This is taken from: https://benjamin-altpeter.de/shell-openexternal-dangers/
import { spawn } from 'node:child_process';
import { basename } from 'node:path';
import { URL } from 'node:url';
import { shell } from 'electron';
import { ensureDirSync, existsSync, readJsonSync } from 'fs-extra';
import normalizeUrl from 'normalize-url';
import { ALLOWED_PROTOCOLS } from '../config';

const debug = require('../preload-safe-debug')('Ferdium:Helpers:url');

// Reads the settings file directly so this works in the main process, the
// renderer and the webview preload without extra wiring.
const readAppSettings = (): Record<string, unknown> => {
  try {
    // eslint-disable-next-line global-require
    const { userDataPath } = require('../environment-remote');
    const settingsFile = userDataPath('config', 'settings.json');
    if (!existsSync(settingsFile)) {
      return {};
    }

    return readJsonSync(settingsFile);
  } catch (error) {
    debug('Could not read app settings', error);
    return {};
  }
};

// User-configured extra protocols (e.g. 'rustdesk, ssh') that may be handed
// to the operating system's protocol handler.
const getAdditionalAllowedProtocols = (): string[] => {
  const settings = readAppSettings();
  const raw =
    typeof settings.additionalAllowedProtocols === 'string'
      ? settings.additionalAllowedProtocols
      : '';

  return raw
    .split(',')
    .map(protocol => protocol.trim().toLowerCase().replace(/:$/, ''))
    .filter(Boolean)
    .map(protocol => `${protocol}:`);
};

// Hosts of well-known identity providers. Sign-in links are often plain
// target=_blank links; opening them in an external browser would strand the
// login outside the service's session, so they must stay in-app.
const SIGN_IN_HOST_PATTERNS = [
  /(^|\.)login\.microsoftonline\.com$/,
  /(^|\.)login\.microsoft\.com$/,
  /(^|\.)login\.live\.com$/,
  /(^|\.)login\.windows\.net$/,
  /(^|\.)account\.microsoft\.com$/,
  /(^|\.)accounts\.google\.com$/,
  /(^|\.)appleid\.apple\.com$/,
  /(^|\.)id\.atlassian\.com$/,
  /(^|\.)login\.yahoo\.com$/,
  /(^|\.)okta\.com$/,
  /(^|\.)onelogin\.com$/,
  /(^|\.)duosecurity\.com$/,
  /(^|\.)auth0\.com$/,
];

export const isSignInUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return SIGN_IN_HOST_PATTERNS.some(pattern => pattern.test(hostname));
  } catch {
    return false;
  }
};

// Approximation of the registrable domain (last two labels). Not aware of
// multi-part public suffixes like co.uk, which errs on the side of treating
// such hosts as related - acceptable for deciding where a link opens.
const registrableDomain = (hostname: string): string =>
  hostname.split('.').slice(-2).join('.');

export const isSameSite = (urlA: string, urlB: string): boolean => {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    if (!a.hostname || !b.hostname) {
      return false;
    }
    return registrableDomain(a.hostname) === registrableDomain(b.hostname);
  } catch {
    return false;
  }
};

export const isValidExternalURL = (url: string | URL): boolean => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.toString());
  } catch {
    return false;
  }

  const isAllowed =
    ALLOWED_PROTOCOLS.includes(parsedUrl.protocol) ||
    getAdditionalAllowedProtocols().includes(parsedUrl.protocol);
  debug('protocol check is', isAllowed, 'for:', url);

  return isAllowed;
};

export const fixUrl = (url: string | URL): string => {
  return url
    .toString()
    .replaceAll('//', '/')
    .replaceAll('http:/', 'http://')
    .replaceAll('https:/', 'https://')
    .replaceAll('file:/', 'file://');
};

export const isValidFileUrl = (path: string): boolean => {
  return path.startsWith('file') && existsSync(new URL(path));
};

export async function openPath(folderName: string): Promise<void> {
  ensureDirSync(folderName);
  shell.openPath(folderName);
}

interface ExternalBrowserSettings {
  browserPath: string;
  privateMode: boolean;
}

const getExternalBrowserSettings = (): ExternalBrowserSettings => {
  const settings = readAppSettings();
  return {
    browserPath:
      typeof settings.externalBrowserPath === 'string'
        ? settings.externalBrowserPath.trim()
        : '',
    privateMode: settings.externalBrowserPrivateMode === true,
  };
};

// The command-line switch that opens a private/incognito window, by browser
// family. Returns null when the browser is not recognized - the url is then
// opened normally rather than passing a flag the browser may misinterpret.
export const privateModeFlag = (browserPath: string): string | null => {
  const executable = basename(browserPath).toLowerCase();
  if (
    /firefox|librewolf|waterfox|palemoon|icecat|mullvad|floorp|zen/.test(
      executable,
    )
  ) {
    return '-private-window';
  }
  if (/msedge|edge/.test(executable)) {
    return '-inprivate';
  }
  if (/opera/.test(executable)) {
    return '--private';
  }
  if (/chrome|chromium|brave|vivaldi|iron|thorium/.test(executable)) {
    return '--incognito';
  }
  return null;
};

const openWithExternalBrowser = (
  { browserPath, privateMode }: ExternalBrowserSettings,
  url: string,
): void => {
  debug('Open url:', url, 'with custom browser:', browserPath);
  const fallback = (error: Error) => {
    console.error(
      `Could not open '${url}' with the custom browser '${browserPath}', falling back to the system default browser`,
      error,
    );
    shell.openExternal(url);
  };

  const flag = privateMode ? privateModeFlag(browserPath) : null;
  const args = flag === null ? [url] : [flag, url];

  try {
    const browserProcess = spawn(browserPath, args, {
      detached: true,
      stdio: 'ignore',
    });
    // A missing 'error' listener would turn a bad executable path into an
    // uncaught exception that crashes the whole app.
    browserProcess.on('error', fallback);
    browserProcess.unref();
  } catch (error) {
    fallback(error as Error);
  }
};

// TODO: Need to verify and fix/remove the skipping logic. Ideally, we should never skip this check
export const openExternalUrl = (
  url: string | URL,
  skipValidityCheck: boolean = false,
): void => {
  const rawUrl = url.toString();
  // fixUrl only knows how to restore the double slash of http/https/file
  // urls and would mangle other protocols (rustdesk:// -> rustdesk:/), so
  // leave those untouched.
  const fixedUrl = /^(?:https?|file):/i.test(rawUrl) ? fixUrl(rawUrl) : rawUrl;
  debug('Open url:', fixedUrl, 'with skipValidityCheck:', skipValidityCheck);
  if (skipValidityCheck || isValidExternalURL(fixedUrl)) {
    const browserSettings = getExternalBrowserSettings();
    // Only web links belong in a browser; anything else (rustdesk:, mailto-
    // style handlers, ...) always goes to the OS protocol handler.
    const isWebUrl = /^https?:/i.test(fixedUrl);
    if (browserSettings.browserPath === '' || !isWebUrl) {
      shell.openExternal(fixedUrl.toString());
    } else {
      openWithExternalBrowser(browserSettings, fixedUrl.toString());
    }
  }
};

export const normalizedUrl = (url: string) => {
  return normalizeUrl(url, {
    stripAuthentication: false,
    stripWWW: false,
    removeTrailingSlash: false,
  });
};
