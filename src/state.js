export function createStore(initialState) {
  let state = structuredClone(initialState);

  return {
    getState() {
      return state;
    },
    patch(partial) {
      state = { ...state, ...partial };
      return state;
    },
    mutate(mutator) {
      mutator(state);
      return state;
    },
    reset(nextInitialState) {
      state = structuredClone(nextInitialState);
      return state;
    }
  };
}
