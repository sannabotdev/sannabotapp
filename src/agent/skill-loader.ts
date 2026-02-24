/**
 * SkillLoader – Loads SKILL.md files from assets/skills/
 * In React Native we use require() for bundled assets.
 * Skills are registered at build time via the skill registry below.
 * Dynamic skills uploaded by the user are loaded from AsyncStorage at runtime.
 */
import { Platform } from 'react-native';
import IntentModule from '../native/IntentModule';
import type { DynamicSkillStore } from './dynamic-skill-store';
import { registerBundledSkillName } from './skill-validator';

export interface CredentialRequirement {
  id: string;
  label: string;
  type: 'oauth' | 'api_key' | 'password';
  auth_provider?: string;
}

export interface SkillFrontmatter {
  name: string;
  description: string;
  category?: string;
  test_prompt?: string;
  android_package?: string;
  /** If set, this tool is exclusive to this skill and will be removed when the skill is disabled. */
  exclusive_tool?: string;
  permissions?: string[];
  credentials?: CredentialRequirement[];
}

export interface SkillInfo {
  name: string;
  description: string;
  category: string;
  path: string;
  content: string;
  testPrompt?: string;
  android_package?: string;
  /** If set, this tool is exclusive to this skill and will be removed when the skill is disabled. */
  exclusiveTool?: string;
  permissions: string[];
  credentials: CredentialRequirement[];
}

/**
 * Parse YAML-like frontmatter from SKILL.md content.
 * Supports simple key: value pairs and arrays.
 */
export function parseFrontmatter(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    // No frontmatter – use filename as fallback
    return {
      frontmatter: { name: 'unknown', description: '' },
      body: content,
    };
  }

  const yamlBlock = match[1];
  const body = match[2] ?? '';

  const frontmatter: SkillFrontmatter = {
    name: '',
    description: '',
    permissions: [],
    credentials: [],
  };

  // Simple line-by-line YAML parser (supports scalars and simple arrays)
  const lines = yamlBlock.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w+):\s*(.*)$/);
    if (keyMatch) {
      const key = keyMatch[1];
      const value = keyMatch[2].trim();

      if (value === '' || value === '|' || value === '>') {
        // Potentially a block or array – collect indented lines
        const items: string[] = [];
        i++;
        while (i < lines.length && (lines[i].startsWith(' ') || lines[i].startsWith('\t'))) {
          items.push(lines[i].trim().replace(/^-\s*/, ''));
          i++;
        }

        if (key === 'permissions') {
          frontmatter.permissions = items;
        } else if (key === 'credentials') {
          // Parse credential objects
          const creds: CredentialRequirement[] = [];
          let currentCred: Partial<CredentialRequirement> = {};
          for (const item of items) {
            const credMatch = item.match(/^(\w+):\s*(.+)$/);
            if (credMatch) {
              const [, credKey, credVal] = credMatch;
              if (credKey === 'id') {
                if (currentCred.id) {
                  creds.push(currentCred as CredentialRequirement);
                  currentCred = {};
                }
                currentCred.id = credVal.replace(/^['"]|['"]$/g, '');
              } else if (credKey === 'label') {
                currentCred.label = credVal.replace(/^['"]|['"]$/g, '');
              } else if (credKey === 'type') {
                currentCred.type = credVal.replace(/^['"]|['"]$/g, '') as CredentialRequirement['type'];
              } else if (credKey === 'auth_provider') {
                currentCred.auth_provider = credVal.replace(/^['"]|['"]$/g, '');
              }
            }
          }
          if (currentCred.id) {
            creds.push(currentCred as CredentialRequirement);
          }
          frontmatter.credentials = creds;
        }
        continue;
      } else {
        // Simple scalar
        const cleanValue = value.replace(/^['"]|['"]$/g, '');
        if (key === 'name') {
          frontmatter.name = cleanValue;
        } else if (key === 'description') {
          frontmatter.description = cleanValue;
        } else if (key === 'test_prompt') {
          frontmatter.test_prompt = cleanValue;
        } else if (key === 'android_package') {
          frontmatter.android_package = cleanValue;
        } else if (key === 'category') {
          frontmatter.category = cleanValue;
        } else if (key === 'exclusive_tool') {
          frontmatter.exclusive_tool = cleanValue;
        }
      }
    }
    i++;
  }

  return { frontmatter, body };
}

/**
 * Check whether an Android package is installed on the device.
 * Uses the IntentModule native bridge (Android only).
 * Returns true on non-Android platforms (skills are always available).
 */
async function checkAppInstalled(packageName: string): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  try {
    return await IntentModule.isAppInstalled(packageName);
  } catch {
    // If the native module is unavailable, assume installed
    return true;
  }
}

/**
 * Static skill registry. In React Native, assets are bundled at build time.
 * Add new skills here as the app grows.
 *
 * Each entry contains the raw SKILL.md content (imported as string via metro).
 */
const SKILL_REGISTRY: Record<string, string> = {};

/** Register a skill's raw markdown content at startup */
export function registerSkillContent(name: string, content: string): void {
  SKILL_REGISTRY[name] = content;
}

/**
 * SkillLoader loads and parses all registered skills.
 * Bundled (build-time) skills are loaded synchronously in the constructor.
 * Dynamic (user-uploaded) skills are loaded asynchronously via loadDynamicSkills().
 */
export class SkillLoader {
  private skills: Map<string, SkillInfo> = new Map();

  constructor() {
    this.loadAll();
  }

  private loadAll(): void {
    for (const [key, content] of Object.entries(SKILL_REGISTRY)) {
      const { frontmatter, body } = parseFrontmatter(content);
      const skillInfo: SkillInfo = {
        name: frontmatter.name || key,
        description: frontmatter.description,
        category: frontmatter.category ?? 'other',
        path: `assets/skills/${key}/SKILL.md`,
        content: body,
        testPrompt: frontmatter.test_prompt,
        android_package: frontmatter.android_package,
        exclusiveTool: frontmatter.exclusive_tool,
        permissions: frontmatter.permissions ?? [],
        credentials: frontmatter.credentials ?? [],
      };
      this.skills.set(skillInfo.name, skillInfo);
      // Track bundled names so the validator can reject uploads with same name
      registerBundledSkillName(skillInfo.name);
    }
  }

  /**
   * Load user-uploaded skills from AsyncStorage and register them.
   * Call this once during app startup after biometric unlock.
   * Dynamic skills are tagged with path "dynamic/<name>/SKILL.md".
   */
  async loadDynamicSkills(store: DynamicSkillStore): Promise<void> {
    try {
      const allSkills = await store.loadAllSkills();
      for (const [key, content] of Object.entries(allSkills)) {
        this.registerDynamicSkill(key, content);
      }
    } catch {
      // Non-critical – app works fine with bundled skills only
    }
  }

  /**
   * Register a single dynamic skill at runtime (after upload or on startup).
   * Replaces any existing skill with the same name.
   */
  registerDynamicSkill(key: string, content: string): void {
    const { frontmatter, body } = parseFrontmatter(content);
    const skillInfo: SkillInfo = {
      name: frontmatter.name || key,
      description: frontmatter.description,
      category: frontmatter.category ?? 'other',
      path: `dynamic/${key}/SKILL.md`,
      content: body,
      testPrompt: frontmatter.test_prompt,
      android_package: frontmatter.android_package,
      exclusiveTool: frontmatter.exclusive_tool,
      permissions: frontmatter.permissions ?? [],
      credentials: frontmatter.credentials ?? [],
    };
    this.skills.set(skillInfo.name, skillInfo);
    // Also push into SKILL_REGISTRY so headless tasks see it too
    registerSkillContent(key, content);
  }

  /**
   * Remove a dynamic skill from the in-memory registry.
   * Call after deleting it from DynamicSkillStore.
   */
  unregisterSkill(name: string): void {
    this.skills.delete(name);
  }

  /** Return true if the skill was uploaded dynamically (not bundled). */
  isDynamic(name: string): boolean {
    const skill = this.skills.get(name);
    return skill?.path?.startsWith('dynamic/') ?? false;
  }

  /**
   * Return names of skills that work out-of-the-box: no runtime permissions
   * and no OAuth/API-key credentials required.
   * Install-time permissions (e.g. INTERNET) don't count as "required".
   */
  getPermissionFreeSkillNames(): string[] {
    const INSTALL_TIME = new Set(['android.permission.INTERNET']);
    return Array.from(this.skills.values())
      .filter(s =>
        s.permissions.every(p => INSTALL_TIME.has(p)) &&
        s.credentials.length === 0,
      )
      .map(s => s.name);
  }

  /** Get all skills (regardless of permission/credential status) */
  getAllSkills(): SkillInfo[] {
    return Array.from(this.skills.values());
  }

  /** Get a single skill by name */
  getSkill(name: string): SkillInfo | undefined {
    return this.skills.get(name);
  }

  /**
   * Check which skills have their required Android app installed.
   * Returns a map: skillName → true/false.
   * Skills without `android_package` are always considered available.
   */
  async checkAppAvailability(): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};

    for (const skill of this.getAllSkills()) {
      if (!skill.android_package) {
        result[skill.name] = true;
      } else {
        result[skill.name] = await checkAppInstalled(skill.android_package);
      }
    }

    return result;
  }

  /**
   * Return tool names that should be removed from the registry because their
   * owning skill is disabled.  Only considers skills with an `exclusive_tool`.
   */
  getDisabledExclusiveTools(enabledSkillNames: string[]): string[] {
    const enabledSet = new Set(enabledSkillNames);
    const disabled: string[] = [];
    for (const skill of this.skills.values()) {
      if (skill.exclusiveTool && !enabledSet.has(skill.name)) {
        disabled.push(skill.exclusiveTool);
      }
    }
    return disabled;
  }

  /**
   * Build XML skill summary for system prompt
   * Only includes enabled skills.
   */
  buildSkillsSummary(enabledSkillNames: string[]): string {
    const enabled = enabledSkillNames
      .map(n => this.skills.get(n))
      .filter((s): s is SkillInfo => s !== undefined);

    if (enabled.length === 0) {
      return '';
    }

    const lines = ['<skills>'];
    for (const skill of enabled) {
      lines.push('  <skill>');
      lines.push(`    <name>${escapeXML(skill.name)}</name>`);
      lines.push(`    <description>${escapeXML(skill.description)}</description>`);
      lines.push('  </skill>');
    }
    lines.push('</skills>');
    return lines.join('\n');
  }

  /**
   * Build full skill content for system prompt.
   * Includes the SKILL.md body for each enabled skill.
   */
  buildSkillsContent(enabledSkillNames: string[]): string {
    const parts: string[] = [];
    for (const name of enabledSkillNames) {
      const skill = this.skills.get(name);
      if (skill) {
        parts.push(`### Skill: ${skill.name}\n\n${skill.content}`);
      }
    }
    return parts.join('\n\n---\n\n');
  }
}

function escapeXML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
