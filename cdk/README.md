# initech-terminal-cdk

AWS CDK infrastructure for INITECH TERMINAL.

## What this deploys

- **S3 bucket** — private origin for the Vue SPA build (`dist/`)
- **CloudFront distribution** — public site, OAC-signed S3 origin, SPA error-routing (403/404 → `/index.html`)
- **Lambda (`NodejsFunction`)** — Node.js 20, 512MB, 10s timeout. Bundles `../lambda/src/handler.ts` with esbuild
- **API Gateway v2 (HTTP API)** — single `POST /api/parse-intent` route, CORS open
- IAM policy grants `bedrock:InvokeModel` on the **inference profile** `us.anthropic.claude-haiku-4-5` AND the underlying `anthropic.claude-haiku-4-5-*` foundation model ARN (both are required when invoking via an inference profile)

## Prerequisites

1. AWS credentials configured (`aws configure` or `AWS_PROFILE`).
2. CDK bootstrapped in your target account/region (one-time per account/region):
   ```bash
   npx cdk bootstrap aws://ACCOUNT_ID/us-west-2
   ```
3. **Bedrock model access enabled** for Claude Haiku in `us-west-2`:
   - AWS Console → Bedrock → **Model access** (left sidebar)
   - Click **Modify model access**
   - Enable **Anthropic → Claude Haiku 4.5**
   - Submit — access is typically granted instantly for Anthropic models
   - The inference profile `us.anthropic.claude-haiku-4-5` will resolve to whichever underlying region Bedrock routes to; you do **not** need to enable the profile separately, only the underlying model.

## Install & deploy

```bash
cd cdk
npm install
npm run deploy
```

Outputs after deploy:
- `SiteBucketName` — upload `dist/` here (`aws s3 sync ../dist s3://<bucket>`)
- `CloudFrontDomain` — public URL
- `IntentApiEndpoint` — the HTTP API. The Vue app calls `/api/parse-intent` relatively; in production you'll either proxy via CloudFront (recommended — add a behavior pointing to the API) or set `VITE_API_BASE` to this endpoint.

## Useful commands

- `npm run synth` — synthesize the CloudFormation template
- `npm run diff` — compare deployed vs. local
- `npm run deploy` — deploy
- `npm run cdk -- destroy` — tear down
