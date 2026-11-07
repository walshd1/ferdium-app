import { outputJsonSync, pathExistsSync, readJsonSync } from 'fs-extra';
import { isEqual } from 'lodash';
import { makeObservable, observable, toJS } from 'mobx';
import { userDataPath } from '../environment-remote';

const debug = require('../preload-safe-debug')('Ferdium:Settings');

export default class Settings {
  type: string = '';

  defaultState: object;

  @observable store: object = {};

  constructor(type: string, defaultState = {}) {
    makeObservable(this);

    this.type = type;
    this.store = defaultState;
    this.defaultState = defaultState;

    if (pathExistsSync(this.settingsFile)) {
      this._hydrate();
    } else {
      this._writeFile();
    }
  }

  set(settings: object): void {
    const nextSettings = this._merge(settings);
    if (isEqual(this.store, nextSettings)) {
      return;
    }

    this._writeFile(nextSettings);
    this.store = nextSettings;
  }

  get all(): object {
    return this.store;
  }

  get allSerialized(): object {
    return toJS(this.store);
  }

  get(key: string | number): any {
    return this.store[key];
  }

  _merge(settings: object): object {
    return { ...this.defaultState, ...this.store, ...settings };
  }

  _hydrate(): void {
    try {
      this.store = this._merge(readJsonSync(this.settingsFile));
      debug('Hydrate store', this.type, this.allSerialized);
    } catch (error) {
      // A corrupted or unreadable settings file (e.g. a failing drive) must
      // not prevent the app from starting - fall back to the defaults.
      console.error(
        `Could not read settings file (${this.type}), using defaults`,
        error,
      );
      this.store = { ...this.defaultState };
    }
  }

  _writeFile(settings: object = this.store): void {
    try {
      outputJsonSync(this.settingsFile, settings, {
        spaces: 2,
      });
      debug('Write settings file', this.type, toJS(settings));
    } catch (error) {
      // A vanished or failing drive must not turn every settings update into
      // an exception - the in-memory settings keep working for this session.
      console.error(`Could not write settings file (${this.type})`, error);
    }
  }

  get settingsFile(): string {
    return userDataPath(
      'config',
      `${this.type === 'app' ? 'settings' : this.type}.json`,
    );
  }
}
