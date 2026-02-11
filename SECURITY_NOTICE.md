# 🔒 SECURITY NOTICE - Webhook Leak Detected

## Critical Security Issue

A **Microsoft Power Apps webhook URL** was found in the git repository containing:
- Workflow ID: `8ae49f4a7e1541159fcc1883784d3955`
- API signature/key in the `sig` parameter

This webhook URL was exposed in:
- `log.txt` (lines 4, 10, 16, ...) - Currently exists in working directory
- Git history (commits: 42fdabd, 9fb814a)

## Immediate Actions Required

### 1. Regenerate the Webhook (CRITICAL)

⚠️ **You MUST regenerate a new webhook URL immediately**

1. Go to your Microsoft Power Platform/Power Automate
2. Navigate to the workflow: `8ae49f4a7e1541159fcc1883784d3955`
3. Delete or disable the current trigger
4. Create a new HTTP trigger to generate a fresh webhook URL with new signature
5. Update your alert configuration with the new URL

### 2. Remove Sensitive Data from Git History

The webhook URL has been committed to git. To remove it:

```bash
# Option 1: If you haven't pushed to a remote repository
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch log.txt' \
  --prune-empty --tag-name-filter cat -- --all

# Option 2: If you've already pushed (more aggressive)
# WARNING: This rewrites history and requires force-push
git filter-repo --path log.txt --invert-paths

# After either option, force push if needed
git push origin --force --all
```

### 3. Update Configuration Files

The app stores alert configurations in:
- Location: `{userData}/app-config.json`
- On macOS: `~/Library/Application Support/guideapp_electron/app-config.json`
- On Windows: `%APPDATA%/guideapp_electron/app-config.json`

After regenerating the webhook:
1. Open the app
2. Go to Settings → Email Alerts
3. Update the endpoint URL with your new webhook
4. Test the alert to confirm it works

## Security Improvements Implemented

✅ **Logging sanitized**: Webhook URLs no longer logged with query parameters  
✅ **Enhanced .gitignore**: Added patterns to prevent log files and secrets from being committed  
✅ **Security markers**: Comments added to identify sensitive configuration areas

## Prevention Guidelines

To avoid future leaks:

1. **Never commit log files** - They may contain sensitive runtime data
2. **Use environment variables** for secrets when possible
3. **Review git diffs** before committing to catch sensitive data
4. **Rotate credentials** that may have been exposed
5. **Use .gitignore properly** to exclude logs, configs, and secrets

## Questions?

If you need help:
- Regenerating webhooks: [Power Automate Documentation](https://learn.microsoft.com/en-us/power-automate/)
- Git history cleanup: [git-filter-repo](https://github.com/newren/git-filter-repo)

---

**Date Created**: 2026-02-11  
**Severity**: HIGH - Exposed API credentials  
**Status**: ⚠️ WEBHOOK MUST BE REGENERATED
