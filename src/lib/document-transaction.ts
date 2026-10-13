import { AsyncLocalStorage } from "node:async_hooks";

// One local server owns the database. Transactions take this fence so receipt
// numbers and visit quotas cannot race, in addition to MongoDB atomic commits.
const globalState = globalThis as unknown as { documentFence?: { tail: Promise<void>; context: AsyncLocalStorage<boolean> } };
const state = globalState.documentFence ??= { tail: Promise.resolve(), context: new AsyncLocalStorage<boolean>() };

export async function withDocumentFence<T>(operation: () => Promise<T>): Promise<T> {
  if (state.context.getStore()) return operation();
  const previous = state.tail;
  let release!: () => void;
  state.tail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await state.context.run(true, operation); }
  finally { release(); }
}
