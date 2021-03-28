// import * as apigateway from "@aws-cdk/aws-apigateway";
import { Function, Runtime, Code } from '@aws-cdk/aws-lambda';
import { Duration, Stack, Construct, StackProps, CfnParameter } from '@aws-cdk/core';
import { Bucket, EventType } from '@aws-cdk/aws-s3';
import { Topic } from '@aws-cdk/aws-sns';
import { SnsEventSource, S3EventSource } from '@aws-cdk/aws-lambda-event-sources';
import { ResourcePolicy, Secret } from '@aws-cdk/aws-secretsmanager';

// const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, MONGODB_FULL_URI,  } = process.env;
const TWITCH_CLIENT_ID = '2nakqoqdxka9v5oekyo6742bmnxt2o';
export class SlStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const messageStoreBucket = new Bucket(this, 'MessageStore');


    const vodPoller = new Function(this, 'VodPoller', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('lambdas/poller'),
      memorySize: 128,
      timeout: Duration.seconds(900),
      handler: 'handler.main',
      environment: {
        BUCKET: messageStoreBucket.bucketName,
        TWITCH_CLIENT_ID,
      },
    });

    // follow below link on how to add new secrets
    // https://docs.aws.amazon.com/cdk/latest/guide/get_secrets_manager_value.html
    const twitchSecret = Secret.fromSecretAttributes(this, 'TWITCH_CLIENT_SECRET', {
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-1:576758376358:secret:TWITCH_CLIENT_SECRET-OyAp7V',
    });

    const mongoSecret = Secret.fromSecretAttributes(this, 'MONGODB_FULL_URI', {
      secretCompleteArn:
        'arn:aws:secretsmanager:us-east-1:576758376358:secret:MONGODB_FULL_URI-DBSAtt',
    });
    twitchSecret.grantRead(vodPoller);
    mongoSecret.grantRead(vodPoller);


    const downloadLambda = new Function(this, 'DownloadHandler', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('lambdas/downloader'),
      memorySize: 128,
      timeout: Duration.seconds(900),
      handler: 'handler.main',
      environment: {
        BUCKET: messageStoreBucket.bucketName,
      },
    });

    

    const readyForDownloadsTopic = new Topic(this, 'ReadyForDownloads');

    new SnsEventSource(readyForDownloadsTopic).bind(downloadLambda);

    const clipFinder = new Function(this, 'ClipFinder', {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset('lambdas/clipfinder'),
      memorySize: 128,
      timeout: Duration.seconds(900),
      handler: 'handler.main',
      environment: {
        BUCKET: messageStoreBucket.bucketName,
      },
    });

    messageStoreBucket.grantRead(clipFinder);

    new S3EventSource(messageStoreBucket, { events: [EventType.OBJECT_CREATED] }).bind(
      downloadLambda
    );
  }
}
