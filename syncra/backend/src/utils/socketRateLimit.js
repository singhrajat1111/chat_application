// Per-socket rate limiter — tracks event counts in sliding windows
// Key: socketId:eventName, Value: array of timestamps

const counters = new Map();

/**
 * Create a rate limiter for socket events.
 * @param {number} maxEvents - Max events allowed in the window
 * @param {number} windowMs - Window duration in milliseconds
 * @returns {function} - (socket, eventName) => boolean (true = allowed, false = rate limited)
 */
export function createSocketRateLimiter(maxEvents, windowMs) {
  return (socket, eventName) => {
    const key = `${socket.id}:${eventName}`;
    const now = Date.now();
    let timestamps = counters.get(key);

    if (!timestamps) {
      timestamps = [];
      counters.set(key, timestamps);
    }

    // Remove expired timestamps
    while (timestamps.length > 0 && now - timestamps[0] > windowMs) {
      timestamps.shift();
    }

    if (timestamps.length >= maxEvents) {
      return false; // rate limited
    }

    timestamps.push(now);
    return true; // allowed
  };
}

// Clean up entries for disconnected sockets
export function cleanupSocket(socketId) {
  for (const key of counters.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      counters.delete(key);
    }
  }
}
