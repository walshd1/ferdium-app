import { KEEP_WS_LOADED_USID } from '../../../src/config';
import Workspace from '../../../src/features/workspaces/models/Workspace';

describe('Workspace model', () => {
  it('keeps a plain service list as-is', () => {
    const workspace = new Workspace({
      id: 'w1',
      name: 'Clients',
      services: ['a', 'b', 'c'],
    });

    expect([...workspace.services]).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates services so a service can never be mounted twice', () => {
    const workspace = new Workspace({
      id: 'w1',
      name: 'Clients',
      services: ['a', 'b', 'a', 'c', 'b'],
    });

    expect([...workspace.services]).toEqual(['a', 'b', 'c']);
  });

  it('adds the keep-loaded sentinel when saving with keepLoaded', () => {
    const workspace = new Workspace({
      id: 'w1',
      name: 'Clients',
      services: ['a'],
      saving: true,
      keepLoaded: true,
    });

    expect([...workspace.services]).toEqual(['a', KEEP_WS_LOADED_USID]);
  });

  it('removes the keep-loaded sentinel when saving without keepLoaded', () => {
    const workspace = new Workspace({
      id: 'w1',
      name: 'Clients',
      services: ['a', KEEP_WS_LOADED_USID, 'b'],
      saving: true,
      keepLoaded: false,
    });

    expect([...workspace.services]).toEqual(['a', 'b']);
  });

  it('throws without an id', () => {
    expect(() => new Workspace({ name: 'broken', services: [] })).toThrow(
      'Workspace requires Id',
    );
  });
});
