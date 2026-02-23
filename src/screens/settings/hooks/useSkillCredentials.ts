import { useCallback, useEffect, useState } from 'react';
import type { CredentialManager } from '../../../permissions/credential-manager';
import type { SkillInfo } from '../../../agent/skill-loader';

export function useSkillCredentials(
  allSkills: SkillInfo[],
  credentialManager: CredentialManager,
) {
  const [skillCredentialStatus, setSkillCredentialStatus] = useState<Record<string, boolean>>({});

  const checkSkillCredentials = useCallback(async () => {
    const status: Record<string, boolean> = {};
    for (const skill of allSkills) {
      status[skill.name] = await credentialManager.areAllConfigured(skill.credentials);
    }
    setSkillCredentialStatus(status);
  }, [allSkills, credentialManager]);

  useEffect(() => {
    checkSkillCredentials();
  }, [checkSkillCredentials]);

  return { skillCredentialStatus, checkSkillCredentials };
}
