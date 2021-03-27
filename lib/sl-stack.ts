// import * as apigateway from "@aws-cdk/aws-apigateway";
import { Function, Runtime, Code } from "@aws-cdk/aws-lambda";
import { Duration, Stack, Construct, StackProps, CfnParameter } from "@aws-cdk/core";
import { Bucket, EventType } from "@aws-cdk/aws-s3";
import { Topic } from "@aws-cdk/aws-sns";
import {
  SnsEventSource,
  S3EventSource,
} from "@aws-cdk/aws-lambda-event-sources";
export class SlStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const messageStoreBucket = new Bucket(this, "MessageStore");

    const downloadLambda = new Function(this, "DownloadHandler", {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset("lambdas/downloader"),
      memorySize: 128,
      timeout: Duration.seconds(900),
      handler: "downloads.main",
      environment: {
        BUCKET: messageStoreBucket.bucketName,
      },
    });

    


    messageStoreBucket.grantWrite(downloadLambda);

    const readyForDownloadsTopic = new Topic(this, "ReadyForDownloads");

    new SnsEventSource(readyForDownloadsTopic).bind(downloadLambda);



    const clipFinder = new Function(this, "ClipFinder", {
      runtime: Runtime.NODEJS_14_X,
      code: Code.fromAsset("lambdas/clipfinder"),
      memorySize: 128,
      timeout: Duration.seconds(900),
      handler: "downloads.main",
      environment: {
        BUCKET: messageStoreBucket.bucketName,
      },
    });

    messageStoreBucket.grantRead(clipFinder);

    new S3EventSource(messageStoreBucket, { events: [EventType.OBJECT_CREATED] }).bind(downloadLambda);
  }
}
