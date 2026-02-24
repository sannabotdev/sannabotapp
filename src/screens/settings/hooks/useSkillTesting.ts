import { useCallback, useState } from 'react';
import type { SkillInfo } from '../../../agent/skill-loader';
import { t } from '../../../i18n';

type TestResult = {
  success: boolean;
  message: string;
  error?: string;
  evidence?: {
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
    toolResults: Array<{ toolName: string; result: string; isError: boolean }>;
    finalResponse?: string;
    iterations: number;
  };
};

export function useSkillTesting(
  onTestSkill?: (skillName: string) => Promise<TestResult>,
) {
  const [testingSkill, setTestingSkill] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [evidenceModalVisible, setEvidenceModalVisible] = useState(false);
  const [evidenceModalContent, setEvidenceModalContent] = useState<{
    title: string;
    text: string;
    result: TestResult;
  } | null>(null);

  const buildEvidenceText = useCallback((result: TestResult): string => {
    if (!result.evidence) return '';

    const { toolCalls, toolResults, finalResponse, iterations } = result.evidence;

    let evidenceText = `${t('evidence.iterations').replace('{count}', String(iterations))}\n\n`;

    if (toolCalls.length > 0) {
      evidenceText += `${t('evidence.toolCalls')}\n`;
      toolCalls.forEach((tc, idx) => {
        evidenceText += `\n${idx + 1}. ${tc.name}()\n`;
        try {
          const argsStr = JSON.stringify(tc.arguments, null, 2);
          const formattedArgs = argsStr
            .split('\n')
            .slice(0, 10)
            .map(line => `   ${line}`)
            .join('\n');
          evidenceText += formattedArgs;
          if (argsStr.split('\n').length > 10) {
            evidenceText += `\n${t('evidence.truncatedLines')}`;
          }
        } catch {
          evidenceText += `   ${String(tc.arguments).substring(0, 150)}`;
        }
        evidenceText += '\n';
      });
    }

    if (toolResults.length > 0) {
      evidenceText += `\n${t('evidence.toolResults')}\n`;
      toolResults.forEach((tr, idx) => {
        const status = tr.isError ? '❌' : '✓';
        evidenceText += `\n${idx + 1}. ${status} ${tr.toolName}\n`;
        let resultPreview = tr.result;
        try {
          const parsed = JSON.parse(tr.result);
          resultPreview = JSON.stringify(parsed, null, 2);
          const lines = resultPreview.split('\n');
          const formattedLines = lines.slice(0, 20).map(line => `   ${line}`);
          evidenceText += formattedLines.join('\n');
          if (lines.length > 20) {
            evidenceText += `\n${t('evidence.truncatedLines')}`;
          }
        } catch {
          const plainText = tr.result.substring(0, 300);
          evidenceText += `   ${plainText}${tr.result.length > 300 ? '...' : ''}`;
        }
        evidenceText += '\n';
      });
    }

    if (finalResponse) {
      evidenceText += `\n\n${t('evidence.finalResponse')}\n`;
      let formattedResponse = finalResponse;
      try {
        const parsed = JSON.parse(finalResponse);
        formattedResponse = JSON.stringify(parsed, null, 2);
      } catch {
        // Not JSON, use as-is
      }
      const lines = formattedResponse.split('\n');
      const previewLines = lines.slice(0, 15);
      evidenceText += previewLines.map(line => `   ${line}`).join('\n');
      if (lines.length > 15) {
        evidenceText += `\n${t('evidence.truncatedLines')}`;
      }
    }

    return evidenceText;
  }, []);

  const showEvidencePopup = useCallback(
    (result: TestResult) => {
      const title = result.success ? t('evidence.success') : t('evidence.failure');

      let evidenceText = '';
      if (result.evidence) {
        evidenceText = buildEvidenceText(result);
      } else {
        evidenceText = result.message;
        if (result.error) {
          evidenceText += `\n\nError:\n${result.error}`;
        }
      }

      setEvidenceModalContent({ title, text: evidenceText, result });
      setEvidenceModalVisible(true);
    },
    [buildEvidenceText],
  );

  const handleCloseEvidenceModal = useCallback(() => {
    setEvidenceModalVisible(false);
  }, []);

  const handleTestSkill = useCallback(
    async (skill: SkillInfo) => {
      if (!onTestSkill || !skill.testPrompt) return;

      setTestingSkill(skill.name);
      try {
        const result = await onTestSkill(skill.name);
        setTestResults(prev => ({ ...prev, [skill.name]: result }));

        if (result.evidence) {
          showEvidencePopup(result);
        }
      } catch (err) {
        setTestResults(prev => ({
          ...prev,
          [skill.name]: {
            success: false,
            message: t('evidence.failure'),
            error: err instanceof Error ? err.message : String(err),
          },
        }));
      } finally {
        setTestingSkill(null);
      }
    },
    [onTestSkill, showEvidencePopup],
  );

  return {
    testingSkill,
    testResults,
    evidenceModalVisible,
    evidenceModalContent,
    handleTestSkill,
    showEvidencePopup,
    handleCloseEvidenceModal,
  };
}
