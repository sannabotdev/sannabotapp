/**
 * SkillValidator – Validates SKILL.md content before it is stored.
 *
 * Validation rules:
 *  - Max file size: 50 KB
 *  - Must have valid YAML frontmatter block (---\n...\n---)
 *  - Required fields: name (non-empty string), description (non-empty string)
 *  - Optional fields: test_prompt, android_package (strings)
 *  - permissions: must be array of non-empty strings if present
 *  - credentials: must be array of objects with id, label, type if present
 *  - name must not conflict with built-in bundled skill names
 */
import { parseFrontmatter } from './skill-loader';

const MAX_SKILL_SIZE_BYTES = 50 * 1024; // 50 KB

/** Names of skills bundled at build time (auto-populated at runtime) */
const BUNDLED_SKILL_NAMES = new Set<string>();

/** Register a built-in skill name to prevent upload conflicts */
export function registerBundledSkillName(name: string): void {
  BUNDLED_SKILL_NAMES.add(name);
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate the raw SKILL.md content string.
 * Returns { valid: true } on success or { valid: false, error: '<reason>' }.
 */
export function validateSkillContent(content: string): ValidationResult {
  // 1. Size check
  const byteLength = new TextEncoder().encode(content).length;
  if (byteLength > MAX_SKILL_SIZE_BYTES) {
    return {
      valid: false,
      error: `Skill file too large (${Math.round(byteLength / 1024)} KB). Maximum allowed size is 50 KB.`,
    };
  }

  // 2. Frontmatter presence check
  const frontmatterRegex = /^---\n[\s\S]*?\n---/;
  if (!frontmatterRegex.test(content)) {
    return {
      valid: false,
      error:
        'Missing YAML frontmatter. The file must start with a --- block containing name and description.',
    };
  }

  // 3. Parse frontmatter
  const { frontmatter } = parseFrontmatter(content);

  // 4. Required fields: name
  if (!frontmatter.name || frontmatter.name.trim() === '' || frontmatter.name === 'unknown') {
    return {
      valid: false,
      error: 'Missing required frontmatter field: name. Add "name: your-skill-name" to the --- block.',
    };
  }

  // 5. Required fields: description
  if (!frontmatter.description || frontmatter.description.trim() === '') {
    return {
      valid: false,
      error:
        'Missing required frontmatter field: description. Add "description: ..." to the --- block.',
    };
  }

  // 6. Name format: only lowercase letters, digits, hyphens
  const namePattern = /^[a-z0-9-]+$/;
  if (!namePattern.test(frontmatter.name.trim())) {
    return {
      valid: false,
      error:
        'Invalid skill name: only lowercase letters, digits and hyphens are allowed (e.g. "my-skill").',
    };
  }

  // 7. Conflict with bundled skills
  if (BUNDLED_SKILL_NAMES.has(frontmatter.name.trim())) {
    return {
      valid: false,
      error: `A built-in skill named "${frontmatter.name}" already exists. Choose a different name.`,
    };
  }

  // 8. permissions schema check
  if (frontmatter.permissions !== undefined) {
    if (!Array.isArray(frontmatter.permissions)) {
      return { valid: false, error: 'frontmatter "permissions" must be an array of strings.' };
    }
    for (const perm of frontmatter.permissions) {
      if (typeof perm !== 'string' || perm.trim() === '') {
        return {
          valid: false,
          error: 'Each entry in "permissions" must be a non-empty string.',
        };
      }
    }
  }

  // 9. credentials schema check
  if (frontmatter.credentials !== undefined) {
    if (!Array.isArray(frontmatter.credentials)) {
      return { valid: false, error: 'frontmatter "credentials" must be an array of objects.' };
    }
    for (const cred of frontmatter.credentials) {
      if (typeof cred !== 'object' || cred === null) {
        return { valid: false, error: 'Each credential must be an object.' };
      }
      if (!cred.id || typeof cred.id !== 'string') {
        return { valid: false, error: 'Each credential must have a string field "id".' };
      }
      if (!cred.label || typeof cred.label !== 'string') {
        return { valid: false, error: 'Each credential must have a string field "label".' };
      }
      if (!cred.type || !['oauth', 'api_key', 'password'].includes(cred.type)) {
        return {
          valid: false,
          error:
            'Each credential "type" must be one of: oauth, api_key, password.',
        };
      }
    }
  }

  return { valid: true };
}

/** Extract the skill name from validated content (convenience helper) */
export function extractSkillName(content: string): string {
  const { frontmatter } = parseFrontmatter(content);
  return frontmatter.name.trim();
}
