// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { reducer } from './use-toast';

type ToastState = Parameters<typeof reducer>[0];
type ToastAction = Parameters<typeof reducer>[1];

const createState = (...ids: string[]): ToastState => ({
  toasts: ids.map((id) => ({
    id,
    open: true,
    onOpenChange: () => {},
  })),
});

const createAction = (action: ToastAction): ToastAction => action;

describe('use-toast reducer', () => {
  it('keeps only the newest toast when the limit is exceeded', () => {
    const firstState = reducer(
      createState(),
      createAction({
        type: 'ADD_TOAST',
        toast: {
          id: '1',
          open: true,
          title: 'first',
          onOpenChange: () => {},
        },
      })
    );

    const secondState = reducer(
      firstState,
      createAction({
        type: 'ADD_TOAST',
        toast: {
          id: '2',
          open: true,
          title: 'second',
          onOpenChange: () => {},
        },
      })
    );

    expect(secondState.toasts).toHaveLength(1);
    expect(secondState.toasts[0]?.id).toBe('2');
    expect(secondState.toasts[0]?.title).toBe('second');
  });

  it('updates only the matching toast', () => {
    const state = reducer(
      createState('1'),
      createAction({
        type: 'UPDATE_TOAST',
        toast: {
          id: '1',
          title: 'updated',
        },
      })
    );

    expect(state.toasts[0]?.title).toBe('updated');
    expect(state.toasts[0]?.id).toBe('1');
  });

  it('marks only the targeted toast as closed on dismiss', () => {
    const state = reducer(
      createState('1', '2'),
      createAction({
        type: 'DISMISS_TOAST',
        toastId: '2',
      })
    );

    expect(state.toasts[0]?.open).toBe(true);
    expect(state.toasts[1]?.open).toBe(false);
  });

  it('removes all toasts when no toast id is provided', () => {
    const state = reducer(
      createState('1', '2'),
      createAction({
        type: 'REMOVE_TOAST',
      })
    );

    expect(state.toasts).toEqual([]);
  });
});
