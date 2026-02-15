import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface StorageStackProps extends cdk.StackProps {
  transcriptionRequestQueue: cdk.aws_sqs.IQueue;
}

export class StorageStack extends cdk.Stack {
  public readonly sourceBucket: cdk.aws_s3.Bucket;
  public readonly destBucket: cdk.aws_s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.sourceBucket = new cdk.aws_s3.Bucket(this, 'sourceAudioBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      publicReadAccess: false,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          id: 'Delete old objects',
          enabled: true,
          expiration: cdk.Duration.days(7),
        },
      ],
    });

    this.destBucket = new cdk.aws_s3.Bucket(this, 'destTranscriptionBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      blockPublicAccess: cdk.aws_s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      publicReadAccess: false,
      encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
    });

    const queueDestination = new cdk.aws_s3_notifications.SqsDestination(props.transcriptionRequestQueue);
    const audioSuffixes = ['.mp3', '.wav', '.aac', '.flac'];

    for (const suffix of audioSuffixes) {
      this.sourceBucket.addEventNotification(cdk.aws_s3.EventType.OBJECT_CREATED, queueDestination, { suffix });
    }
  }
}
