import * as apigateway from '@aws-cdk/aws-apigateway';
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
import { StateMachine, Parallel } from '@aws-cdk/aws-stepfunctions';
import { LambdaInvoke } from '@aws-cdk/aws-stepfunctions-tasks';

// const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, MONGODB_FULL_URI,  } = process.env;
const TWITCH_CLIENT_ID_ARN =
  'arn:aws:secretsmanager:us-east-1:576758376358:secret:TWITCH_CLIENT_ID-dKQAIn';
const TWITCH_CLIENT_SECRET_ARN =
  'arn:aws:secretsmanager:us-east-1:576758376358:secret:TWITCH_CLIENT_SECRET-OyAp7V';
const MONGODB_FULL_URI_ARN =
  'arn:aws:secretsmanager:us-east-1:576758376358:secret:MONGODB_FULL_URI-DBSAtt';
export class SlStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    mongoDBDatabase: string = 'pillar',
    props?: StackProps
  ) {
    super(scope, id, props);

    const messageStoreBucket = new Bucket(this, 'MessageStore');
    const thumbnailStoreBucket = new Bucket(this, 'ThumbnailStore');

    const newUserSignup = new Topic(this, 'NewUserSignup');
    const readyForDownloadsTopic = new Topic(this, 'ReadyForDownloads');
    const vodDataRequested = new Topic(this, 'VodDataRequested');
    const thumbnailGeneratorTopic = new Topic(this, 'ThumbnailGeneratorTopic');
    const chatMessagesDownloaded = new Topic(this, 'ChatMessagesDownloaded');

    const twitchClient = Secret.fromSecretCompleteArn(this, 'twitchClient', TWITCH_CLIENT_ID_ARN);

    const TWITCH_CLIENT_ID = twitchClient.secretValue.toString();

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
        TOPIC: thumbnailGeneratorTopic.topicArn,
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
      secretCompleteArn: TWITCH_CLIENT_SECRET_ARN,
    });

    const mongoSecret = Secret.fromSecretAttributes(this, 'MONGODB_FULL_URI', {
      secretCompleteArn: MONGODB_FULL_URI_ARN,
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

    readyForDownloadsTopic.grantPublish(vodPoller);
    vodDataRequested.grantPublish(vodPoller);

    new SnsEventSource(readyForDownloadsTopic).bind(downloadLambda);

    const automaticClipGenerator = new PythonFunction(this, 'Automatic Clip Generator', {
      description: 'Finds clips with the Pillar Algorithms',
      runtime: Runtime.PYTHON_3_9,
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

    twitchSecret.grantRead(automaticClipGenerator);
    thumbnailGeneratorTopic.grantPublish(automaticClipGenerator);
    new SnsEventSource(chatMessagesDownloaded).bind(automaticClipGenerator);

    const cccGenerator = new PythonFunction(this, 'CCC Generator', {
      description: 'Finds CCC on Twitch',
      runtime: Runtime.PYTHON_3_9,
      handler: 'handler',
      index: 'handler.py',
      entry: './lambdas/cccfinder',
      memorySize: 256,
      timeout: Duration.seconds(60),
      environment: {
        TWITCH_CLIENT_ID: TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET_ARN: twitchSecret.secretArn,
        DB_NAME: mongoDBDatabase,
      },
    });

    twitchSecret.grantRead(cccGenerator);
    mongoSecret.grantRead(cccGenerator);

    const manualClipGenerator = new PythonFunction(this, 'Manual Clip Generator', {
      description: 'Allows manual clipping',
      runtime: Runtime.PYTHON_3_9,
      handler: 'handler',
      index: 'handler.py',
      entry: './lambdas/manualclips',
      memorySize: 256,
      timeout: Duration.seconds(120),
      environment: {
        TWITCH_CLIENT_ID: TWITCH_CLIENT_ID,
        TWITCH_CLIENT_SECRET_ARN: twitchSecret.secretArn,
        DB_NAME: mongoDBDatabase,
        BUCKET: messageStoreBucket.bucketName,
      },
    });

    new SnsEventSource(chatMessagesDownloaded).bind(manualClipGenerator);

    twitchSecret.grantRead(manualClipGenerator);
    mongoSecret.grantRead(manualClipGenerator);
    messageStoreBucket.grantRead(manualClipGenerator);

    new SnsEventSource(vodDataRequested).bind(cccGenerator);

    messageStoreBucket.grantWrite(downloadLambda);

    messageStoreBucket.grantRead(automaticClipGenerator);
    mongoSecret.grantRead(automaticClipGenerator);

    mongoSecret.grantRead(thumbnailGenerator);

    messageStoreBucket.addEventNotification(
      EventType.OBJECT_CREATED,
      new SnsDestination(chatMessagesDownloaded)
    );

    const checkForMessages = new LambdaInvoke(this, 'Check for Messages', {
      lambdaFunction: vodPoller,
    });

    const downloadTwitchChat = new LambdaInvoke(this, 'Download Twitch Chat', {
      lambdaFunction: downloadLambda,
      payloadResponseOnly: true,
      resultPath: '$.chatDownload',
      // outputPath: '$.chatDownload.Payload',
    });

    // const downloadAllChats = new Map(this, "Download All Twitch Chats").iterator(downloadTwitchChat)

    const generateAutomaticClips = new LambdaInvoke(this, 'Generate Clip Timestamps', {
      lambdaFunction: automaticClipGenerator,
      payloadResponseOnly: true,
    });

    const generateCCCs = new LambdaInvoke(this, 'Generate CCCs', {
      lambdaFunction: cccGenerator,
      payloadResponseOnly: true,
    });

    const generateManualClips = new LambdaInvoke(this, 'Generate Manual Clips', {
      lambdaFunction: manualClipGenerator,
      payloadResponseOnly: true,
    });

    const generateThumbnails = new LambdaInvoke(this, 'Generate Clip Thumbnails', {
      lambdaFunction: thumbnailGenerator,
      payloadResponseOnly: true,
    });

    const processTwitchChat = new Parallel(this, 'Process Twitch Chat', {
      resultPath: '$.clips',
      inputPath: '$.chatDownload',
    });
    processTwitchChat.branch(generateAutomaticClips);
    processTwitchChat.branch(generateManualClips);
    processTwitchChat.next(generateThumbnails);

    const videoIdHydration = new Parallel(this, 'Hydrate Video Id');
    videoIdHydration.branch(downloadTwitchChat.next(processTwitchChat));
    videoIdHydration.branch(generateCCCs);

    const definition = videoIdHydration;

    const stateMachine = new StateMachine(this, 'PreProcessing', {
      definition,
      timeout: Duration.minutes(5),
    });
  }
}
