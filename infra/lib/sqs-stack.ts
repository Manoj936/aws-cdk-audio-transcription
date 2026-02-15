import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class SqsStack extends cdk.Stack {
  public readonly transcriptionRequestQueue: cdk.aws_sqs.Queue;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const deadLetterQueue = new cdk.aws_sqs.Queue(this, 'transcriptionDeadLetterQueue', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.transcriptionRequestQueue = new cdk.aws_sqs.Queue(this, 'transcriptionRequestQueue', {
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(10),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue,
      },
    });
  }
}
