import * as apigateway from "@aws-cdk/aws-apigateway";
import { DockerImageCode, DockerImageFunction, Runtime } from '@aws-cdk/aws-lambda';
import { Duration, Stack, Construct, StackProps } from '@aws-cdk/core';
import { Bucket, EventType } from '@aws-cdk/aws-s3';
import { SnsDestination } from '@aws-cdk/aws-s3-notifications';
import { Topic } from '@aws-cdk/aws-sns';
import { SnsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import { Secret } from '@aws-cdk/aws-secretsmanager';
import { Rule, Schedule } from '@aws-cdk/aws-events';
import { LambdaFunction } from '@aws-cdk/aws-events-targets';
import { PythonFunction } from '@aws-cdk/aws-lambda-python';
import { NodejsFunction } from '@aws-cdk/aws-lambda-nodejs';

// const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, MONGODB_FULL_URI,  } = process.env;
const TWITCH_CLIENT_ID = '2nakqoqdxka9v5oekyo6742bmnxt2o';
const TWITCH_CLIENT_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:576758376358:secret:TWITCH_CLIENT_SECRET-OyAp7V';
const MONGODB_FULL_URI_ARN = 'arn:aws:secretsmanager:us-east-1:576758376358:secret:MONGODB_FULL_URI-DBSAtt';
export class SlStack extends Stack {
  constructor(scope: Construct, id: string, mongoDBDatabase: string = 'pillar', props?: StackProps) {
    super(scope, id, props);

    const messageStoreBucket = new Bucket(this, 'MessageStore');
    const thumbnailStoreBucket = new Bucket(this, 'ThumbnailStore');

    const newUserSignup = new Topic(this, 'NewUserSignup');
    const readyForDownloadsTopic = new Topic(this, 'ReadyForDownloads');
    const vodDataRequested = new Topic(this, 'VodDataRequested');
    const thumbnailGeneratorTopic = new Topic(this, 'ThumbnailGeneratorTopic');
    const chatMessagesDownloaded = new Topic(this, 'ChatMessagesDownloaded');

    const vodPoller = new NodejsFunction(this, 'VodPoller', {
      description: 'Checks for VODs',
      runtime: Runtime.NODEJS_14_X,
      entry: './lambdas/poller/handler.js',
      memorySize: 256,
      timeout: Duration.seconds(60),
      handler: 'main',
      environment: {
        BUCKET: messageStoreBucket.bucketName,
        TWITCH_CLIENT_ID: TWITCH_CLIENT_ID,
        TOPIC: readyForDownloadsTopic.topicArn,
        DB_NAME: mongoDBDatabase,
        REFRESH_VOD_TOPIC: vodDataRequested.topicArn,
      },
    });

    vodDataRequested.grantPublish(vodPoller);
    new SnsEventSource(newUserSignup).bind(vodPoller);

    const thumbnailGenerator = new DockerImageFunction(this, 'ThumbnailGenerator', {
      code: DockerImageCode.fromImageAsset('./lambdas/thumbnailgenerator'),
      description: 'Generates thumbnails for each clip generated by ClipFinder',
      timeout: Duration.seconds(900),
      memorySize: 1280,
      environment: {
        BUCKET: thumbnailStoreBucket.bucketName,
        DB_NAME: mongoDBDatabase,
        TOPIC: thumbnailGeneratorTopic.topicArn
      },
    });

    thumbnailStoreBucket.grantReadWrite(thumbnailGenerator);
    thumbnailStoreBucket.grantPutAcl(thumbnailGenerator);

    new SnsEventSource(thumbnailGeneratorTopic).bind(thumbnailGenerator);

    new Rule(this, 'CheckForVods', {
      schedule: Schedule.cron({ minute: '*/5', hour: '*', day: '*' }),
      targets: [new LambdaFunction(vodPoller)],
    });

    messageStoreBucket.grantRead(vodPoller);
    // follow below link on how to add new secrets
    // https://docs.aws.amazon.com/cdk/latest/guide/get_secrets_manager_value.html

    const twitchSecret = Secret.fromSecretAttributes(this, 'TWITCH_CLIENT_SECRET', {
      secretCompleteArn:
        TWITCH_CLIENT_SECRET_ARN,
    });

    const mongoSecret = Secret.fromSecretAttributes(this, 'MONGODB_FULL_URI', {
      secretCompleteArn:
        MONGODB_FULL_URI_ARN,
    });

    twitchSecret.grantRead(vodPoller);
    mongoSecret.grantRead(vodPoller);

    const downloadLambda = new NodejsFunction(this, 'ChatDownloader', {
      description: 'Downloads chat and saves to S3',
      runtime: Runtime.NODEJS_14_X,
      entry: './lambdas/downloader/handler.js',
      memorySize: 1280,
      timeout: Duration.seconds(900),
      handler: 'main',
      environment: {
        BUCKET: messageStoreBucket.bucketName,
      },
    });
    
    const chatDownloaderApi = new apigateway.LambdaRestApi(this, 'chatdownloader-api', {
      handler: downloadLambda,
      proxy: false
    });

    const videoIdsResource = chatDownloaderApi.root.addResource('video_id');
    const videoId = videoIdsResource.addResource('{video_id}');
    videoId.addMethod('POST');
    videoId.addMethod('GET');

    readyForDownloadsTopic.grantPublish(vodPoller);
    vodDataRequested.grantPublish(vodPoller);

    new SnsEventSource(readyForDownloadsTopic).bind(downloadLambda);

    const clipFinder = new PythonFunction(this, 'ClipFinder', {
      description: 'Finds clips with the Pillar Algorithms',
      runtime: Runtime.PYTHON_3_8,
      handler: 'handler',
      index: 'handler.py',
      entry: './lambdas/clipfinder',
      memorySize: 1280,
      timeout: Duration.seconds(900),
      environment: {
        BUCKET: messageStoreBucket.bucketName,
        TWITCH_CLIENT_ID: TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET_ARN: twitchSecret.secretArn,
        DB_NAME: mongoDBDatabase,
        TOPIC: thumbnailGeneratorTopic.topicArn,
      },
    });

    twitchSecret.grantRead(clipFinder)
    thumbnailGeneratorTopic.grantPublish(clipFinder);
    new SnsEventSource(chatMessagesDownloaded).bind(clipFinder);

    const cccFinder = new PythonFunction(this, 'CCCFinder', {
      description: 'Finds CCC on Twitch',
      runtime: Runtime.PYTHON_3_8,
      handler: 'handler',
      index: 'handler.py',
      entry: './lambdas/cccfinder',
      memorySize: 256,
      timeout: Duration.seconds(60),
      environment: {
        TWITCH_CLIENT_ID: TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET_ARN: twitchSecret.secretArn,
        DB_NAME: mongoDBDatabase
      },
    });

    twitchSecret.grantRead(cccFinder);
    mongoSecret.grantRead(cccFinder);

    const manualClip = new PythonFunction(this, 'ManualClip', {
      description: 'Allows manual clipping',
      runtime: Runtime.PYTHON_3_8,
      handler: 'handler',
      index: 'handler.py',
      entry: './lambdas/manualclips',
      memorySize: 256,
      timeout: Duration.seconds(120),
      environment: {
        TWITCH_CLIENT_ID: TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET_ARN: twitchSecret.secretArn,
        DB_NAME: mongoDBDatabase,
        BUCKET: messageStoreBucket.bucketName
      },
    });

    new SnsEventSource(chatMessagesDownloaded).bind(manualClip);

    twitchSecret.grantRead(manualClip);
    mongoSecret.grantRead(manualClip);
    messageStoreBucket.grantRead(manualClip);

    new SnsEventSource(vodDataRequested).bind(cccFinder);

    messageStoreBucket.grantWrite(downloadLambda);

    messageStoreBucket.grantRead(clipFinder);
    mongoSecret.grantRead(clipFinder);

    mongoSecret.grantRead(thumbnailGenerator);
    
    messageStoreBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new SnsDestination(chatMessagesDownloaded),
    )
  }
}
