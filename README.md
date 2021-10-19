# Pre-Processing

This repo contains the code to create clips for a stream, and store them in MongoDb. 

We use CDK to define our infrastructure, and the application code is hosted on AWS Lambda. 

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template

## Testing locally
To test the functions locally, you must have NodeJS latest LTS, AWS CLI, AWS SAM, AWS CDK, and Python 3.8, and Docker installed. After those are installed, run the following in the project directory.
```
npm i
npm run synth
```

That will set up NPM and AWS SAM for testing locally. You can then run the lambdas locally with the following:
```
npm run clipgenerator
npm run poller
npm run downloader
npm run cccfinder
```
