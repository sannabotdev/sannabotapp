const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Extended to:
 * - Support .md files as raw text strings (for SKILL.md assets)
 * - Support NativeWind / Tailwind CSS processing
 */
const config = {
  resolver: {
    // Allow importing .md files
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'cjs', 'mjs', 'json', 'md'],
  },
  transformer: {
    babelTransformerPath: require.resolve('./src/metro/md-transformer'),
    // Enable require.context() for auto-discovering skill files at bundle time
    unstable_allowRequireContext: true,
  },
};

module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), {
  input: './global.css',
});
