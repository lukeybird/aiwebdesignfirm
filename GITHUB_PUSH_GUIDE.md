# GitHub Push Guide

Complete guide for pushing code to GitHub with all necessary information.

## Prerequisites

1. **GitHub Account**: You need a GitHub account (you have: `lukeybird`)
2. **Repository Created**: Repository must exist on GitHub (yours: `aiwebdesignfirm`)
3. **Git Installed**: Git should be installed on your system
4. **Authentication**: Personal Access Token or SSH keys configured

## Authentication Setup

### Option 1: Personal Access Token (Recommended for HTTPS)

1. **Create a Token**:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Name it (e.g., "Real Token")
   - Select expiration (90 days, or No expiration)
   - **Select scopes**: Check `repo` (this includes all repository permissions)
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again)

2. **Required Permissions**:
   - ✅ `repo` - Full control of private repositories
     - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
   - ❌ No other scopes needed for basic push/pull operations

3. **Store Credentials**:
   ```bash
   git config --global credential.helper osxkeychain  # macOS
   # or
   git config --global credential.helper wincred      # Windows
   ```

### Option 2: SSH Keys (Alternative)

1. **Generate SSH Key**:
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   ```

2. **Add to GitHub**:
   - Copy public key: `cat ~/.ssh/id_ed25519.pub`
   - Go to: https://github.com/settings/keys
   - Click "New SSH key" and paste

3. **Update Remote**:
   ```bash
   git remote set-url origin git@github.com:lukeybird/aiwebdesignfirm.git
   ```

## Initial Setup (First Time Only)

If this is a new project:

```bash
# 1. Initialize git repository
git init

# 2. Add all files
git add .

# 3. Make initial commit
git commit -m "Initial commit: [Your project description]"

# 4. Add remote repository
git remote add origin https://github.com/lukeybird/aiwebdesignfirm.git

# 5. Set main branch
git branch -M main

# 6. Push to GitHub
git push -u origin main
```

## Regular Push Workflow

For pushing changes after initial setup:

```bash
# 1. Check status (see what changed)
git status

# 2. Stage changes
git add .                    # Add all changes
# OR
git add <specific-file>      # Add specific file

# 3. Commit changes
git commit -m "Description of changes"

# 4. Push to GitHub
git push
```

## Commit Message Best Practices

Write clear, descriptive commit messages:

- ✅ Good: `"Add portfolio section with browser window thumbnails"`
- ✅ Good: `"Update hero section spacing for mobile devices"`
- ✅ Good: `"Fix favicon display in Chrome browser"`
- ❌ Bad: `"update"`
- ❌ Bad: `"changes"`
- ❌ Bad: `"fix"`

## Common Commands Reference

```bash
# Check repository status
git status

# See what files changed
git diff

# View commit history
git log

# Pull latest changes from GitHub
git pull

# Push to GitHub
git push

# Push to specific branch
git push origin main

# Set upstream branch (first push)
git push -u origin main

# View remote repositories
git remote -v

# Update remote URL
git remote set-url origin <new-url>
```

## Troubleshooting

### Error: "Permission denied (403)"
- **Solution**: Verify your token has `repo` scope
- **Solution**: Regenerate token with correct permissions
- **Solution**: Check if token expired

### Error: "Repository not found"
- **Solution**: Verify repository exists on GitHub
- **Solution**: Check repository name and owner match
- **Solution**: Ensure you have access to the repository

### Error: "Authentication failed"
- **Solution**: Use Personal Access Token (not password)
- **Solution**: Clear stored credentials and re-authenticate
- **Solution**: Check if token is still valid

### Error: "Updates were rejected"
- **Solution**: Pull latest changes first: `git pull`
- **Solution**: Resolve any conflicts
- **Solution**: Push again: `git push`

## Current Repository Information

- **Repository URL**: https://github.com/lukeybird/aiwebdesignfirm.git
- **Remote Name**: `origin`
- **Main Branch**: `main`
- **Authentication**: Personal Access Token (stored in keychain)

## Quick Push Checklist

Before pushing, ensure:
- [ ] All changes are saved
- [ ] You've tested your code
- [ ] Commit message is descriptive
- [ ] You've pulled latest changes (if working with others)
- [ ] Authentication is set up correctly

## Security Notes

⚠️ **Never commit sensitive information**:
- API keys
- Passwords
- Personal Access Tokens
- Private keys
- Environment variables with secrets

✅ **Use `.gitignore`** to exclude:
- `node_modules/`
- `.env` files
- Build artifacts
- IDE settings

## Getting Help

- GitHub Docs: https://docs.github.com
- Git Documentation: https://git-scm.com/doc
- GitHub Support: https://support.github.com

---

**Last Updated**: Based on current project setup
**Repository**: aiwebdesignfirm
**Owner**: lukeybird

