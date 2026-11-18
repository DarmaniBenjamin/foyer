// Slowing down guessing (passwords, voucher codes, the setup code):
// after too many wrong tries from one place, more are refused for a while.
// Kept in memory: a restart forgets them, which only gives a few more tries.
//
// When several copies of Foyer run (index.js), the counting is done by the
// main process for all of them, so a limit means the same with one copy
// or eight (a guesser can't get 8 times the tries by landing on
// different copies).
//   rule: { max, minutes }
//   await tooMany(key, rule) → true when there were already max wrong tries
//   await strike(key, rule)  → one more wrong try
//   await forgive(key)       → start again (e.g. after the right password)
import cluster from "node:cluster";

const tries = new Map(); // key → { count, since }

const windowOf = (rule) => rule.minutes * 60 * 1000;

// ---------- The counting itself (one copy, or the main process) ----------

function countTooMany(key, rule) {
  const entry = tries.get(key);
  if (!entry) return false;
  if (Date.now() - entry.since > windowOf(rule)) {
    tries.delete(key);
    return false;
  }
  return entry.count >= rule.max;
}

function countStrike(key, rule) {
  if (tries.size > 10000)
    for (const [k, v] of tries) if (Date.now() - v.since > 60 * 60 * 1000) tries.delete(k);
  const entry = tries.get(key);
  if (!entry || Date.now() - entry.since > windowOf(rule)) tries.set(key, { count: 1, since: Date.now() });
  else entry.count += 1;
}

const local = {
  tooMany: countTooMany,
  strike: countStrike,
  forgive: (key) => void tries.delete(key),
};

// ---------- Several copies: the main process counts ----------

const asCopy = cluster.isWorker && typeof process.send === "function";
const waiting = new Map(); // question number → answer
let asked = 0;
if (asCopy)
  process.on("message", (m) => {
    if (m?.limitAnswer === undefined) return;
    const done = waiting.get(m.limitAnswer);
    if (done) {
      waiting.delete(m.limitAnswer);
      done(m.value);
    }
  });

function ask(op, key, rule) {
  if (!asCopy) return Promise.resolve(local[op](key, rule));
  const id = ++asked;
  return new Promise((resolve) => {
    // Never wait long: without an answer, it's counted here instead
    const timer = setTimeout(() => {
      waiting.delete(id);
      resolve(local[op](key, rule));
    }, 2000);
    waiting.set(id, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
    process.send({ limit: { id, op, key, rule } });
  });
}

export const tooMany = (key, rule) => ask("tooMany", key, rule);
export const strike = (key, rule) => ask("strike", key, rule);
export const forgive = (key) => ask("forgive", key);

// The main process answers a copy's questions (index.js)
export function answerCopy(worker) {
  worker.on("message", (m) => {
    if (!m?.limit) return;
    const { id, op, key, rule } = m.limit;
    if (!Object.hasOwn(local, op)) return;
    const value = local[op](String(key), rule) ?? null;
    if (worker.isConnected()) worker.send({ limitAnswer: id, value });
  });
}
