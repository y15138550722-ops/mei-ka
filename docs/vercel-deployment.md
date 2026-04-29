# Vercel Deployment

Production URL:

```text
https://meika-admin-demo-20260408.vercel.app
```

## Required Local Git Identity

Vercel production deploys for this project require the latest commit author to have access to the Vercel team. Use the Vercel account email for commits that should deploy:

```bash
git config user.name "y15138550722"
git config user.email "y15138550722@gmail.com"
```

The previous deployment blocker was:

```text
Git author 3058984620@qq.com must have access to the team y15138550722-7484's projects on Vercel to create deployments.
```

## Deploy

Run the local checks and build:

```bash
npm run predeploy:vercel
```

Deploy to production:

```bash
npm run deploy:vercel
```

Verify the stable production domain:

```bash
npm run verify:vercel
```

## Project Settings

The project is linked to Vercel project `meika-admin-demo-20260408`.

The expected Vercel settings are:

```text
Install Command: cd src && npm ci
Build Command: npm run build
Output Directory: src/dist
Node.js Version: 24.x
```

These settings are mirrored in `vercel.json` and checked by `scripts/check-vercel-deploy.mjs`.

## If Deployment Is Blocked Again

1. Run `npm run check:vercel`.
2. Confirm the latest commit author email:

```bash
git show -s --format="%an <%ae>" HEAD
```

3. If the email is not `y15138550722@gmail.com`, set the local Git identity and create a new commit:

```bash
git config user.name "y15138550722"
git config user.email "y15138550722@gmail.com"
git commit --allow-empty -m "Trigger Vercel production deploy"
git push origin main
```

4. Check deployment status:

```bash
npx vercel@latest ls meika-admin-demo-20260408
npx vercel@latest inspect https://meika-admin-demo-20260408.vercel.app
```

The npm deploy script pins Vercel CLI `52.0.0` so routine deploys do not drift when a new CLI release changes behavior.
