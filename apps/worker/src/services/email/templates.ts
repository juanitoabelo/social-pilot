export function postPublishedEmail(postData: {
  platform: string;
  caption: string;
  publishedAt: string;
  imageUrl?: string;
  postUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="padding:32px 32px 0;background:#0f172a;color:#ffffff;">
<h1 style="margin:0;font-size:24px;font-weight:700;">Post Published Successfully</h1>
<p style="margin:8px 0 0;opacity:0.8;font-size:14px;">Your content is now live on ${postData.platform}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:16px;color:#333333;">Your post has been published and is now visible to your audience.</p>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
<p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Caption</p>
<p style="margin:0;font-size:14px;color:#333333;line-height:1.6;">${postData.caption.slice(0, 200)}${postData.caption.length > 200 ? '...' : ''}</p>
</div>
<div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid #e5e7eb;">
<div><p style="margin:0;font-size:12px;color:#6b7280;">Published at</p><p style="margin:4px 0 0;font-size:14px;font-weight:500;">${new Date(postData.publishedAt).toLocaleString()}</p></div>
<div><p style="margin:0;font-size:12px;color:#6b7280;">Platform</p><p style="margin:4px 0 0;font-size:14px;font-weight:500;text-transform:capitalize;">${postData.platform}</p></div>
</div>
${postData.postUrl ? `<p style="margin:24px 0 0;"><a href="${postData.postUrl}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">View Post</a></p>` : ''}
</td></tr>
<tr><td style="padding:0 32px 32px;color:#9ca3af;font-size:12px;">
<p style="margin:0;">You're receiving this because a post was published from your SocialPilot account.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function postFailedEmail(postData: {
  platform: string;
  caption: string;
  error: string;
  retryUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="padding:32px 32px 0;background:#dc2626;color:#ffffff;">
<h1 style="margin:0;font-size:24px;font-weight:700;">Post Failed to Publish</h1>
<p style="margin:8px 0 0;opacity:0.8;font-size:14px;">There was an issue posting to ${postData.platform}</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:16px;color:#333333;">Your scheduled post could not be published. Here are the details:</p>
<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;">
<p style="margin:0 0 8px;font-size:12px;color:#991b1b;text-transform:uppercase;font-weight:600;">Error</p>
<p style="margin:0;font-size:14px;color:#991b1b;">${postData.error}</p>
</div>
<div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px;">
<p style="margin:0 0 8px;font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;">Caption</p>
<p style="margin:0;font-size:14px;color:#333333;line-height:1.6;">${postData.caption.slice(0, 200)}${postData.caption.length > 200 ? '...' : ''}</p>
</div>
<p style="margin:24px 0 0;"><a href="${postData.retryUrl}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Retry Publishing</a></p>
</td></tr>
<tr><td style="padding:0 32px 32px;color:#9ca3af;font-size:12px;">
<p style="margin:0;">You're receiving this because a scheduled post failed to publish from your SocialPilot account.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function weeklyDigestEmail(data: {
  workspaceName: string;
  weekRange: string;
  totalPosts: number;
  avgEngagement: number;
  totalReach: number;
  topPlatform: string;
  topPosts: Array<{ caption: string; platform: string; engagement: number }>;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="padding:32px 32px 0;background:#0f172a;color:#ffffff;">
<h1 style="margin:0;font-size:24px;font-weight:700;">Weekly Analytics Report</h1>
<p style="margin:8px 0 0;opacity:0.8;font-size:14px;">${data.workspaceName} · ${data.weekRange}</p>
</td></tr>
<tr><td style="padding:32px;">
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
<div style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px;"><p style="margin:0;font-size:12px;color:#6b7280;">Posts Published</p><p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0f172a;">${data.totalPosts}</p></div>
<div style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px;"><p style="margin:0;font-size:12px;color:#6b7280;">Avg Engagement</p><p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0f172a;">${(data.avgEngagement * 100).toFixed(1)}%</p></div>
<div style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px;"><p style="margin:0;font-size:12px;color:#6b7280;">Total Reach</p><p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0f172a;">${data.totalReach.toLocaleString()}</p></div>
</div>
<p style="margin:0 0 16px;font-size:14px;color:#333333;">🏆 Top performing platform: <strong>${data.topPlatform}</strong></p>
<h3 style="margin:24px 0 12px;font-size:16px;">Top Posts This Week</h3>
${data.topPosts.map((post, i) => `
<div style="padding:12px 0;${i < data.topPosts.length - 1 ? 'border-bottom:1px solid #e5e7eb;' : ''}">
<div style="display:flex;justify-content:space-between;align-items:center;">
<p style="margin:0;font-size:14px;color:#333333;font-weight:500;">#${i + 1} ${post.caption.slice(0, 60)}...</p>
<p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">${(post.engagement * 100).toFixed(1)}%</p>
</div>
<p style="margin:4px 0 0;font-size:12px;color:#6b7280;text-transform:capitalize;">${post.platform}</p>
</div>
`).join('')}
</td></tr>
<tr><td style="padding:0 32px 32px;color:#9ca3af;font-size:12px;">
<p style="margin:0;">This is your automated weekly analytics report from SocialPilot.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function planLimitWarningEmail(data: {
  planName: string;
  generationsUsed: number;
  generationsLimit: number;
  upgradeUrl: string;
}): string {
  const usagePercent = Math.round((data.generationsUsed / data.generationsLimit) * 100);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
<tr><td style="padding:32px 32px 0;background:#d97706;color:#ffffff;">
<h1 style="margin:0;font-size:24px;font-weight:700;">Plan Limit Approaching</h1>
<p style="margin:8px 0 0;opacity:0.8;font-size:14px;">You've used ${usagePercent}% of your ${data.planName} plan</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:16px;color:#333333;">You're approaching your monthly AI generation limit.</p>
<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin-bottom:24px;">
<p style="margin:0 0 8px;font-size:14px;color:#92400e;"><strong>${data.generationsUsed}</strong> of <strong>${data.generationsLimit === 999999 ? 'Unlimited' : data.generationsLimit}</strong> AI generations used this month</p>
<div style="background:#fde68a;border-radius:999px;height:8px;margin-top:8px;"><div style="background:#d97706;height:8px;border-radius:999px;width:${usagePercent}%;"></div></div>
</div>
<p style="margin:0 0 16px;font-size:14px;color:#6b7280;">When you reach your limit, AI content generation will be paused until next month. Upgrade your plan to continue generating content without interruption.</p>
<p style="margin:24px 0 0;"><a href="${data.upgradeUrl}" style="display:inline-block;padding:12px 24px;background:#d97706;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">Upgrade Plan</a></p>
</td></tr>
<tr><td style="padding:0 32px 32px;color:#9ca3af;font-size:12px;">
<p style="margin:0;">You're receiving this because you've reached 80% of your plan's AI generation limit.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
