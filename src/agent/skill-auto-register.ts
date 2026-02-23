/**
 * skill-auto-register.ts
 *
 * Automatically discovers and registers all SKILL.md files found under
 * assets/skills/<skill-name>/SKILL.md at Metro bundle time.
 *
 * How it works:
 *   Metro's require.context() scans the directory at build time and includes
 *   every matching file in the bundle – no manual imports needed.
 *   Adding a new skill folder is enough; this file never needs to change.
 *
 * Requires metro.config.js:  transformer.unstable_enableRequireContext = true
 */
import { registerSkillContent } from './skill-loader';

// Metro type – not in @types/react-native, declared locally.
declare function require(id: string): unknown;
declare namespace require {
  function context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp,
  ): {
    keys(): string[];
    (key: string): unknown;
  };
}

// Collect every  assets/skills/*/SKILL.md  from the bundle
const ctx = require.context('../../assets/skills', true, /\/SKILL\.md$/);

for (const key of ctx.keys()) {
  // key looks like  ./google-maps/SKILL.md
  const match = key.match(/^\.\/([^/]+)\/SKILL\.md$/);
  if (match) {
    const skillName = match[1];
    const content = ctx(key);
    if (typeof content === 'string') {
      registerSkillContent(skillName, content);
    }
  }
}
