const cache = require('./cacheService');

async function getOrderIndexForStore(store) {
  const cacheKey = `orderIndex:${store}`;
  let index = cache.get(cacheKey) || 0;
  index += 1;
  cache.set(cacheKey, index);
  return index;
}

module.exports = { getOrderIndexForStore };