import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../lib/demoSession', () => ({
  isDemoActive: jest.fn(() => false),
  subscribeDemo: jest.fn(() => () => {}),
}));

import { isDemoActive } from '../lib/demoSession';
import {
  getStatCardsHidden,
  setStatCardsHidden,
  clearStatCardsPref,
} from '../lib/statCardsPref';

const mockedDemo = isDemoActive as jest.Mock;

describe('statCardsPref ($/Mile + Miles row visibility)', () => {
  beforeEach(async () => {
    mockedDemo.mockReturnValue(false);
    await clearStatCardsPref();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.removeItem as jest.Mock).mockClear();
  });

  it('defaults to visible (not hidden)', () => {
    expect(getStatCardsHidden()).toBe(false);
  });

  it('setStatCardsHidden(true) hides and persists', () => {
    setStatCardsHidden(true);
    expect(getStatCardsHidden()).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('stat_cards_hidden_v1', '1');
  });

  it('setStatCardsHidden(false) shows and persists', () => {
    setStatCardsHidden(true);
    setStatCardsHidden(false);
    expect(getStatCardsHidden()).toBe(false);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('stat_cards_hidden_v1', '0');
  });

  it('demo mode changes are session-only (never persisted)', () => {
    mockedDemo.mockReturnValue(true);
    setStatCardsHidden(true);
    expect(getStatCardsHidden()).toBe(true);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('clearStatCardsPref resets to visible and removes the stored flag (logout wipe)', async () => {
    setStatCardsHidden(true);
    await clearStatCardsPref();
    expect(getStatCardsHidden()).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('stat_cards_hidden_v1');
  });

  it('a slow startup hydration read cannot overwrite an explicit user write', async () => {
    let resolveRead!: (v: string | null) => void;
    const slowRead = new Promise<string | null>((res) => { resolveRead = res; });

    jest.isolateModules(() => {
      // Module-load hydration will hang on our deferred promise.
      (AsyncStorage.getItem as jest.Mock).mockReturnValueOnce(slowRead);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fresh = require('../lib/statCardsPref');
      // User hides the row while the read is still in flight...
      fresh.setStatCardsHidden(true);
      // ...then the stale read resolves saying "visible".
      resolveRead(null);
      return slowRead.then(() => {
        expect(fresh.getStatCardsHidden()).toBe(true); // write wins
      });
    });
    await slowRead;
  });
});
