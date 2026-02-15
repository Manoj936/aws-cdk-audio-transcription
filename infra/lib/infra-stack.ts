import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';


export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    

    //1️⃣ Create an source bucket
    const sourceBucket = new cdk.aws_s3.Bucket(this, 'sourceAudioBucket' , {
      removalPolicy : cdk.RemovalPolicy.DESTROY, // Automatically delete the bucket when the stack is deleted
      autoDeleteObjects: true, // Automatically delete all objects in the bucket when the bucket is deleted
      versioned : false,
      blockPublicAccess : cdk.aws_s3.BlockPublicAccess.BLOCK_ALL, // Block all public access to the bucket
      enforceSSL : true, // Enforce SSL for all requests to the bucket
      publicReadAccess : false, // Disable public read access to the bucket,
      lifecycleRules : [
        {
          id : 'Delete old objects',
          enabled : true,
          expiration : cdk.Duration.days(7), // Automatically delete objects after 7 day
        }
      ]
    })
   //2️⃣ Create an destination bucket
    const destBucket = new cdk.aws_s3.Bucket(this, 'destTranscriptionBucket' , {
      removalPolicy : cdk.RemovalPolicy.DESTROY, // Automatically delete the bucket when the stack is deleted
      autoDeleteObjects: true, // Automatically delete all objects in the bucket when the bucket is deleted
      versioned : false,
      blockPublicAccess : cdk.aws_s3.BlockPublicAccess.BLOCK_ALL, // Block all public access to the bucket
      enforceSSL : true, // Enforce SSL for all requests to the bucket
      publicReadAccess : false, // Disable public read access to the bucket
    })
    
    //3️⃣ Create an SQS queue
    const trascriptionRequestQueue = new cdk.aws_sqs.Queue(this, 'trascriptionRequestQueue', {
      visibilityTimeout : cdk.Duration.minutes(5), // Set the visibility timeout to 5 minutes
      retentionPeriod : cdk.Duration.days(10), // Set the retention period to 10 day
      receiveMessageWaitTime : cdk.Duration.seconds(20), // Set the long polling wait time to 20 seconds
      removalPolicy : cdk.RemovalPolicy.DESTROY, // Automatically delete the queue when the stack is deleted
      deadLetterQueue : {
        maxReceiveCount : 5, // Set the maximum receive count to 5
        queue : new cdk.aws_sqs.Queue(this, 'trascriptionRequestDeadLetterQueue', {
          removalPolicy : cdk.RemovalPolicy.DESTROY, // Automatically delete the queue when the stack is deleted
        })
      }
    })
    
    //4️⃣connect the source bucket to the SQS queue when object created with suffix .mp3 / .wav
    sourceBucket.addEventNotification(cdk.aws_s3.EventType.OBJECT_CREATED , new cdk.aws_s3_notifications.SqsDestination(trascriptionRequestQueue), {
      suffix : '.mp3'
    })
    sourceBucket.addEventNotification(cdk.aws_s3.EventType.OBJECT_CREATED , new cdk.aws_s3_notifications.SqsDestination(trascriptionRequestQueue), {
      suffix : '.wav'
    })
  }
}
