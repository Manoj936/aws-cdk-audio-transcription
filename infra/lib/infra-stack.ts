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
    const transcriptionRequestQueue = new cdk.aws_sqs.Queue(this, 'transcriptionRequestQueue', {
      visibilityTimeout : cdk.Duration.minutes(15), // Set the visibility timeout to 15 minutes
      retentionPeriod : cdk.Duration.days(10), // Set the retention period to 10 day
      receiveMessageWaitTime : cdk.Duration.seconds(20), // Set the long polling wait time to 20 seconds
      removalPolicy : cdk.RemovalPolicy.DESTROY, // Automatically delete the queue when the stack is deleted
      deadLetterQueue : {
        maxReceiveCount : 5, // Set the maximum receive count to 5
        queue : new cdk.aws_sqs.Queue(this, 'transcriptionRequestDeadLetterQueue', {
          removalPolicy : cdk.RemovalPolicy.DESTROY, // Automatically delete the queue when the stack is deleted
        })
      }
    })
    
    
    // 4️⃣ Add S3 event notification to trigger the SQS queue when a new audio file is uploaded to the source bucket
    const  allowedExtentions = ['.mp3', '.wav' , '.flac' , '.aac' , '.MP3' , '.WAV' , '.FLAC' , '.AAC'];

    for (let ext of allowedExtentions) {
       sourceBucket.addEventNotification(cdk.aws_s3.EventType.OBJECT_CREATED , new cdk.aws_s3_notifications.SqsDestination(transcriptionRequestQueue), {
       suffix : ext})
    }

    // 5️⃣add cloud front cdn to the destination bucket
    const distribution = new cdk.aws_cloudfront.Distribution(this, 'transcriptionResultDistribution', {
      defaultBehavior: {
        origin: new cdk.aws_cloudfront_origins.S3Origin(destBucket), // Set the S3 bucket as the origin
        viewerProtocolPolicy: cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS, // Redirect HTTP to HTTPS
      },
      defaultRootObject: 'index.html', // Set the default root object (optional)
    });

     // Output the S3 bucket names and the CloudFront distribution domain name
     new cdk.CfnOutput(this,  'DestinationBucketName', {
      value: destBucket.bucketName,
      description: 'The name of the destination S3 bucket for transcription results',
    });
     new cdk.CfnOutput(this,  'CloudFrontDistributionDomainName', {
      value: distribution.domainName,
      description: 'The domain name of the CloudFront distribution for transcription results',
    });
    

    // 6️⃣ add dynamo table to store the status of the transcription job

    const transcriptionTable = new cdk.aws_dynamodb.Table(this, 'TranscriptionStatusTable', {
      partitionKey: {name:'jobId' , type: cdk.aws_dynamodb.AttributeType.STRING}, 
      sortKey : {name:'timestamp' , type: cdk.aws_dynamodb.AttributeType.NUMBER},
      removalPolicy : cdk.RemovalPolicy.DESTROY, // Automatically delete the table when the stack is deleted
      billingMode : cdk.aws_dynamodb.BillingMode.PAY_PER_REQUEST, // Use on-demand billing mode
    })
    
    new cdk.CfnOutput(this,  'TranscriptionStatusTableName', {
      value: transcriptionTable.tableName,
      description: 'The name of the DynamoDB table for transcription status',
    });

    //7️⃣ creating an lambda function to process the transcription job

    const transcriptionProcessorFunction = new cdk.aws_lambda.Function(this, 'TranscriptionProcessorFunction', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
      handler:'index.handler',
      code: cdk.aws_lambda.Code.fromAsset('../lambda/transcriptor'), // Assuming your Lambda function code is in the 'lambda/worker' directory
      timeout: cdk.Duration.minutes(15),
      memorySize:2048,
      environment:{
        SOURCE_BUCKET_NAME : sourceBucket.bucketName,
        DEST_BUCKET_NAME : destBucket.bucketName,
        TRANSCRIPTION_TABLE_NAME : transcriptionTable.tableName,
        QUEUE_URL : transcriptionRequestQueue.queueUrl,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      }
    })
    // 8️⃣ Connect to the sqs
    transcriptionProcessorFunction.addEventSource(new cdk.aws_lambda_event_sources.SqsEventSource(transcriptionRequestQueue, {
      batchSize : 1, // Process one message at a time
      maxBatchingWindow : cdk.Duration.seconds(10), // Wait up to 10 seconds for a batch of messages before invoking the Lambda function
    }))

    // 9️⃣ Grant necessary permissions to the lambda function
    sourceBucket.grantRead(transcriptionProcessorFunction);
    destBucket.grantReadWrite(transcriptionProcessorFunction);
    transcriptionTable.grantReadWriteData(transcriptionProcessorFunction);
    transcriptionRequestQueue.grantConsumeMessages(transcriptionProcessorFunction);
  }
}
