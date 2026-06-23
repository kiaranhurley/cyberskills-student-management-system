# Publish to GitHub

The `Submission/` folder is a standalone Git repository, ready to push.

## One-time: sign in to GitHub CLI

```powershell
gh auth login
```

Choose: **GitHub.com** → **HTTPS** → **Login with a web browser** → follow the prompts.

## Create the public repository and push

```powershell
cd "C:\Users\kiara\Desktop\College\Final Year Project\Submission"
gh repo create cyberskills-student-management-system --public --source=. --remote=origin --description "Full-stack student management system (Django REST API + React) — Final Year Project" --push
```

Your CV link will be:

**https://github.com/kiaranhurley/cyberskills-student-management-system**

## If the repo name is taken

Pick another name, e.g. `cyberskills-sms`:

```powershell
gh repo create cyberskills-sms --public --source=. --remote=origin --description "Full-stack student management system (Django REST API + React)" --push
```

## Manual alternative (no gh)

1. Create an empty repo at https://github.com/new (no README).
2. Run:

```powershell
cd "C:\Users\kiara\Desktop\College\Final Year Project\Submission"
git remote add origin https://github.com/kiaranhurley/cyberskills-student-management-system.git
git push -u origin main
```
