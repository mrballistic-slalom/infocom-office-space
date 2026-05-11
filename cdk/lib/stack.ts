import { Stack, type StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
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

const BEDROCK_MODEL_ID = 'us.anthropic.claude-haiku-4-5';

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
    // CloudFront distribution with Origin Access Control (OAC, not legacy OAI).
    // S3BucketOrigin.withOriginAccessControl wires the OAC + bucket policy automatically.
    // ---------------------------------------------------------------
    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
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
    // Intent parser Lambda. NodejsFunction handles esbuild bundling of the TS source.
    // ---------------------------------------------------------------
    const intentFn = new NodejsFunction(this, 'IntentParserFn', {
      entry: path.join(__dirname, '../../lambda/src/handler.ts'),
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
    // apigatewayv2 + apigatewayv2-integrations are GA in aws-cdk-lib >=2.170 (no alpha needed).
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
    // Outputs
    // ---------------------------------------------------------------
    new CfnOutput(this, 'SiteBucketName', {
      value: siteBucket.bucketName,
      description: 'S3 bucket where the SPA build is uploaded',
    });
    new CfnOutput(this, 'CloudFrontDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain',
    });
    new CfnOutput(this, 'IntentApiEndpoint', {
      value: httpApi.apiEndpoint,
      description: 'HTTP API endpoint (POST /api/parse-intent)',
    });
  }
}
