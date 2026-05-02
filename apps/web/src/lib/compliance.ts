export interface ComplianceCheck {
  rule: string;
  type: "do" | "dont";
  passed: boolean;
}

export interface ComplianceResult {
  score: number;
  checks: ComplianceCheck[];
  violations: string[];
}

export function calculateComplianceScore(
  caption: string,
  hashtags: string[],
  brandConfig: {
    tone?: string;
    do?: string[];
    dont?: string[];
    emoji_policy?: string;
  }
): ComplianceResult {
  const checks: ComplianceCheck[] = [];
  const violations: string[] = [];
  const lowerCaption = caption.toLowerCase();
  const fullText = `${lowerCaption} ${hashtags.join(" ").toLowerCase()}`;

  if (brandConfig.do) {
    for (const rule of brandConfig.do) {
      const keywords = rule.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const passed = keywords.some(kw => fullText.includes(kw));
      checks.push({ rule, type: "do", passed });
      if (!passed) {
        violations.push(`Missing: "${rule}"`);
      }
    }
  }

  if (brandConfig.dont) {
    for (const rule of brandConfig.dont) {
      const keywords = rule.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const passed = !keywords.some(kw => fullText.includes(kw));
      checks.push({ rule, type: "dont", passed });
      if (!passed) {
        violations.push(`Contains prohibited: "${rule}"`);
      }
    }
  }

  if (brandConfig.emoji_policy === "none") {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const hasEmoji = emojiRegex.test(caption);
    checks.push({ rule: "No emojis allowed", type: "dont", passed: !hasEmoji });
    if (hasEmoji) {
      violations.push("Contains emojis (not allowed)");
    }
  }

  if (brandConfig.emoji_policy === "required") {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const hasEmoji = emojiRegex.test(caption);
    checks.push({ rule: "Emojis required", type: "do", passed: hasEmoji });
    if (!hasEmoji) {
      violations.push("Missing emojis (required)");
    }
  }

  const total = checks.length;
  const passed = checks.filter(c => c.passed).length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  return { score, checks, violations };
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-green-600 bg-green-50 border-green-200";
  if (score >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
  return "text-red-600 bg-red-50 border-red-200";
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Failing";
}
