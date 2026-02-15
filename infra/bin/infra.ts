#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SqsStack } from '../lib/sqs-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const sqsStack = new SqsStack(app, 'SqsStack', {
  env,
});

new StorageStack(app, 'StorageStack', {
  env,
  transcriptionRequestQueue: sqsStack.transcriptionRequestQueue,
});
