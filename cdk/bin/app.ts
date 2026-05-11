#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { InitechTerminalStack } from '../lib/stack.js';

const app = new App();

new InitechTerminalStack(app, 'InitechTerminalStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'us-west-2',
  },
  description: 'INITECH TERMINAL — Zork-style text adventure (Office Space). Bedrock Haiku intent parser + CloudFront SPA.',
});
