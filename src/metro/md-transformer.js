/**
 * Custom Metro transformer for .md files.
 * Converts markdown files to JavaScript modules that export the file contents as a string.
 */
const upstreamTransformer = require('metro-babel-transformer');
const path = require('path');
const fs = require('fs');

module.exports.transform = function ({ src, filename, options }) {
  if (filename.endsWith('.md')) {
    // Read the file content and export as a string
    const content = JSON.stringify(src);
    const jsSource = `module.exports = ${content};`;
    return upstreamTransformer.transform({
      src: jsSource,
      filename,
      options,
    });
  }
  return upstreamTransformer.transform({ src, filename, options });
};
