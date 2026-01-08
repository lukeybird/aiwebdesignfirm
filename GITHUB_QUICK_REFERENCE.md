# GitHub Push Quick Reference

Quick commands for pushing code to GitHub.

## First Time Setup

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/lukeybird/aiwebdesignfirm.git
git branch -M main
git push -u origin main
```

## Regular Push (After Setup)

```bash
git add .                              # Stage all changes
git commit -m "Description of changes" # Commit with message
git push                                # Push to GitHub
```

## Authentication

**Personal Access Token Required:**
- Create at: https://github.com/settings/tokens
- Required scope: `repo`
- Use token as password when prompted

## Common Commands

```bash
git status          # Check what changed
git add <file>      # Stage specific file
git add .           # Stage all changes
git commit -m "msg" # Commit changes
git push            # Push to GitHub
git pull            # Pull latest changes
```

## Troubleshooting

- **403 Error**: Token needs `repo` scope
- **Not Found**: Check repository name/URL
- **Rejected**: Pull first with `git pull`

---

For detailed guide, see [GITHUB_PUSH_GUIDE.md](./GITHUB_PUSH_GUIDE.md)

