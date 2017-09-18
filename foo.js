// @flow

type SetAuthState = (?string) => object
//   ~~~~~~~~~~~~
//  RED LINE LINT ERROR HERE

const setAuthState: SetAuthState = (publicKey) => ({
  payload: { publicKey }
})
