# FPAS UI Deployment Guide

## Step 1: Create GitHub Repository

The repository is already configured with remote: `https://github.com/FHIR-IQ/fpas-ui.git`

**Create the repository on GitHub:**

### Option A: Using GitHub Web Interface
1. Go to https://github.com/FHIR-IQ
2. Click **"New repository"**
3. Repository name: `fpas-ui`
4. Description: `Interactive FHIR Prior Authorization System UI - Zero-backend Next.js testing tool for PAS, DTR, CDS Hooks, Provider/Patient Access, and Bulk Export`
5. Visibility: **Public**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click **"Create repository"**

### Option B: Using GitHub CLI
```bash
cd fpas-ui
gh auth login  # Follow prompts to authenticate
gh repo create FHIR-IQ/fpas-ui --public --source=. --remote=origin --description="Interactive FHIR Prior Authorization System UI"
```

## Step 2: Push to GitHub

Once the repository is created on GitHub:

```bash
cd fpas-ui
git push -u origin main
```

You should see:
```
Enumerating objects: 50, done.
Counting objects: 100% (50/50), done.
...
To https://github.com/FHIR-IQ/fpas-ui.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

## Step 3: Deploy to Vercel

### Option A: Connect GitHub Repository (Recommended)

1. Go to https://vercel.com/
2. Click **"Add New"** → **"Project"**
3. Select **"Import Git Repository"**
4. Choose `FHIR-IQ/fpas-ui`
5. Configure Project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
6. **Environment Variables** (click "Add" for each):
   ```
   NEXT_PUBLIC_FHIR_BASE=/api/fhir
   NEXT_PUBLIC_CDS_BASE=/api
   NEXT_PUBLIC_DEFAULT_PATIENT=Patient/pat-001
   NEXT_PUBLIC_PATIENT_TOKEN=mock-patient-token
   NEXT_PUBLIC_PROVIDER_TOKEN=mock-provider-token
   NEXT_PUBLIC_SYSTEM_TOKEN=mock-system-token
   ```
7. Click **"Deploy"**

### Option B: Using Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from fpas-ui directory)
cd fpas-ui
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (Choose your org or personal account)
# - Link to existing project? No
# - What's your project's name? fpas-ui
# - In which directory is your code located? ./
# - Want to modify settings? Yes
# - Framework: Next.js
# - Output directory: .next
# - Build command: npm run build
# - Development command: npm run dev

# After first deployment, set environment variables:
vercel env add NEXT_PUBLIC_FHIR_BASE
# Enter: /api/fhir
# Environment: Production, Preview, Development

vercel env add NEXT_PUBLIC_CDS_BASE
# Enter: /api

vercel env add NEXT_PUBLIC_DEFAULT_PATIENT
# Enter: Patient/pat-001

# Repeat for token variables...

# Deploy to production
vercel --prod
```

## Step 4: Verify Deployment

1. **Check Build Logs**: Ensure no TypeScript errors or build failures
2. **Test Landing Page**: Visit your Vercel URL (e.g., `https://fpas-ui.vercel.app`)
3. **Test CORS Proxy**:
   - Go to `/pas` page
   - Submit an example
   - Check Network tab: requests should go to `/api/fhir/*` (not directly to fpas-phi.vercel.app)
4. **Test All Pages**:
   - ✅ PAS Tester (`/pas`)
   - ✅ DTR Runner (`/dtr`)
   - ✅ CDS Hooks (`/cds`)
   - ✅ Access Viewer (`/access`)
   - ✅ Bulk Export (`/bulk`)
   - ✅ Metrics Dashboard (`/metrics`)

## Troubleshooting Deployment

### Build Fails with TypeScript Errors

**Error**: `Type error: ...`

**Fix**: Check `tsconfig.json` and ensure all TypeScript errors are resolved:
```bash
npm run build  # Test build locally first
```

### CORS Errors Still Occurring

**Symptom**: Requests fail with CORS policy errors

**Check**:
1. Environment variable is set: `NEXT_PUBLIC_FHIR_BASE=/api/fhir`
2. `vercel.json` is in root directory
3. Redeploy after changing env vars

### 404 on API Routes

**Symptom**: `/api/fhir/*` returns 404

**Fix**: Ensure `vercel.json` is in the project root and has correct rewrites:
```json
{
  "rewrites": [
    {
      "source": "/api/fhir/:path*",
      "destination": "https://fpas-phi.vercel.app/fhir/:path*"
    }
  ]
}
```

### Environment Variables Not Working

**Symptom**: Config shows undefined values

**Fix**:
1. Redeploy after adding env vars: `vercel --prod`
2. Check variable names start with `NEXT_PUBLIC_`
3. Verify in Vercel dashboard: Settings → Environment Variables

## Post-Deployment

### Update README with Live URL

Edit `README.md`:
```markdown
## 🌐 Live Demo

**Live URL**: https://fpas-ui.vercel.app

Try it now - no installation required!
```

### Monitor Usage

- Vercel Dashboard: Check deployment logs, analytics
- FPAS Backend: Monitor API usage from UI requests

### Enable Automatic Deployments

With GitHub connected:
- Push to `main` → Auto-deploy to production
- Pull requests → Auto-deploy to preview URLs
- Commit status checks appear in GitHub

---

## Quick Reference

**Repository**: https://github.com/FHIR-IQ/fpas-ui
**Vercel Dashboard**: https://vercel.com/dashboard
**FPAS Backend**: https://fpas-phi.vercel.app

**Commands**:
```bash
# Push code
git push origin main

# Deploy to Vercel
vercel --prod

# View logs
vercel logs <deployment-url>

# List deployments
vercel ls
```