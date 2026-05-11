import { Stack, type StackProps, Duration, RemovalPolicy, CfnOutput, Fn } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { HttpApi, HttpMethod, CorsHttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bedrock cross-region inference profile for Claude Haiku 4.5. The PRD's bare prefix
// (`us.anthropic.claude-haiku-4-5`) is not a valid Bedrock identifier — the actual ID
// includes the model date and version suffix. Verify with:
//   aws bedrock list-inference-profiles --region us-west-2
const BEDROCK_MODEL_ID = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

export class InitechTerminalStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ---------------------------------------------------------------
    // S3 bucket for the Vue SPA build artifacts (private; served via CloudFront OAC).
    // ---------------------------------------------------------------
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ---------------------------------------------------------------
    // Intent parser Lambda. NodejsFunction handles esbuild bundling of the TS source.
    // ---------------------------------------------------------------
    const intentFn = new NodejsFunction(this, 'IntentParserFn', {
      entry: path.join(__dirname, '../../lambda/src/handler.ts'),
      // Pin both projectRoot and the lock file to lambda/ so NodejsFunction doesn't try
      // to root the bundle inside cdk/ (entry would be outside projectRoot otherwise).
      projectRoot: path.join(__dirname, '../../lambda'),
      depsLockFilePath: path.join(__dirname, '../../lambda/package-lock.json'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 512,
      timeout: Duration.seconds(10),
      environment: {
        BEDROCK_MODEL_ID,
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node20',
        minify: true,
        sourceMap: true,
        // Lambda's bundled SDK is fine; keep our handler tree slim.
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Invoking a Bedrock inference profile requires permission on BOTH the
    // inference-profile ARN and the underlying foundation-model ARN(s) it
    // routes to. Granting only the profile yields AccessDeniedException at runtime.
    intentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}:*:inference-profile/${BEDROCK_MODEL_ID}`,
          `arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-*`,
        ],
      }),
    );

    // ---------------------------------------------------------------
    // HTTP API (API Gateway v2) — single POST /api/parse-intent route.
    // ---------------------------------------------------------------
    const httpApi = new HttpApi(this, 'IntentApi', {
      apiName: 'initech-intent-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowHeaders: ['Content-Type'],
        maxAge: Duration.hours(1),
      },
    });

    httpApi.addRoutes({
      path: '/api/parse-intent',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('IntentLambdaIntegration', intentFn),
    });

    // ---------------------------------------------------------------
    // CloudFront distribution. The default behavior serves the SPA from S3 via OAC.
    // The /api/* behavior proxies to API Gateway so the frontend can fetch a same-origin
    // /api/parse-intent without CORS preflight surprises.
    // ---------------------------------------------------------------
    // HttpApi.apiEndpoint is `https://{apiId}.execute-api.{region}.amazonaws.com` — we
    // need just the host for HttpOrigin.
    const apiHost = Fn.select(2, Fn.split('/', httpApi.apiEndpoint));

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.HttpOrigin(apiHost, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          // AllViewerExceptHostHeader keeps the request's Host header out of the upstream
          // call (API Gateway rejects mismatched Host headers), forwarding everything else.
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          compress: true,
        },
      },
      defaultRootObject: 'index.html',
      // SPA routing — let the client router handle deep links.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // ---------------------------------------------------------------
    // Upload the SPA build to S3 and invalidate CloudFront on every deploy.
    // The Vite build must have already produced ../../dist before `cdk deploy` runs.
    // ---------------------------------------------------------------
    new s3deploy.BucketDeployment(this, 'SiteDeployment', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../dist'))],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      prune: true,
    });

    // ---------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------
    new CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'S3 bucket where the SPA build is uploaded',
    });
    new CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain (your public URL)',
    });
    new CfnOutput(this, 'IntentApiEndpoint', {
      value: httpApi.apiEndpoint,
      description: 'HTTP API endpoint (proxied via CloudFront /api/*)',
    });
  }
}
