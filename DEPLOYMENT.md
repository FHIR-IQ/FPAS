# Vercel Deployment Guide

## Required Environment Variables

Set these in your Vercel dashboard:

```bash
# Core Configuration
NODE_ENV=production
PORT=3000
BASE_URL=https://your-app.vercel.app

# Redis Configuration (Use Redis Cloud or similar)
REDIS_URL=redis://your-redis-url:6379

# FHIR Configuration
FHIR_BASE_URL=https://your-app.vercel.app/fhir
FHIR_VERSION=4.0.1

# Security
JWT_SECRET=your-secure-jwt-secret-here
JWT_EXPIRY=1h

# CORS
CORS_ORIGIN=*
CORS_CREDENTIALS=true

# DTR
DTR_LAUNCH_URL=https://your-app.vercel.app/dtr-launch

# Features
ENABLE_SWAGGER_UI=true
ENABLE_X12_MAPPING=false
MOCK_VENDOR_ENABLED=true

# Logging
LOG_LEVEL=info
```

## GitHub Secrets Required

For the GitHub Actions workflow, add these secrets:
- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID

## Deployment Steps

1. Link your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. The GitHub Actions workflow will automatically deploy on push to main
4. Manual deployment: `vercel --prod`

## Testing Endpoints

After deployment, test these endpoints:
- `/health` - Health check
- `/fhir/metadata` - FHIR CapabilityStatement
- `/cds-services/discovery` - CRD Discovery
- `/dtr-launch` - DTR SMART launcher
- `/.well-known/smart-configuration` - SMART configuration

## Production Considerations

- Set up Redis Cloud or similar managed Redis service
- Configure proper CORS origins (not *)
- Use strong JWT secrets
- Monitor logs and performance
- Set up proper domain and SSL