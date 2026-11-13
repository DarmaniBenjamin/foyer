// Slowing down guessing (passwords, voucher codes, the setup code):
// after too many wrong tries from one place, more are refused for a while.
// Kept in memory: a restart forgets them, which only gives a few more tries.
const tries = new Map(); // key → { count, since }

const windowOf = (rule) => rule.minutes * 60 * 1000;

// Already too many wrong tries for this key?
export function tooMany(key, rule) {
  const entry = tries.get(key);
  if (!entry) return false;
  if (Date.now() - entry.since > windowOf(rule)) {
    tries.delete(key);
    return false;
  }
  return entry.count >= rule.max;
}

// One more wrong try
export function strike(key, rule) {
  if (tries.size > 10000)
    for (const [k, v] of tries) if (Date.now() - v.since > 60 * 60 * 1000) tries.delete(k);
  const entry = tries.get(key);
  if (!entry || Date.now() - entry.since > windowOf(rule)) tries.set(key, { count: 1, since: Date.now() });
  else entry.count += 1;
}

export const forgive = (key) => tries.delete(key);
