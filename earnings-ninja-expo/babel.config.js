module.exports = function (api) {
  // Cache by NODE_ENV so the test-only plugin below is applied under jest but
  // never in dev/prod bundles.
  api.cache.using(() => process.env.NODE_ENV);
  const plugins = [];
  if (process.env.NODE_ENV === 'test') {
    // Rewrite `await import(...)` to require() so jest can resolve the lazy
    // ./mutationQueue import in api.upsertGoal (no ESM VM flag needed).
    plugins.push('babel-plugin-dynamic-import-node');
  }
  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
