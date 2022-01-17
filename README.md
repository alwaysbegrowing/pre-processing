# Pre-Processing

## Getting Started

This project requires a Unix-like system (macOS or Linux) and Node 16 to be installed. WSL will work, Ubuntu 20 is recommended.

After cloning the repo, install all dependencies.

```sh
$ yarn
```

To deploy to the test stack for cloud-based testing, run the deploy command.

```sh
yarn run deploy
```

This process can take up to 20 minutes, but usually takes around 3 minutes.


## About the codebase
This repo contains the code to create clips for a stream, and store them in MongoDb. 

We use CDK to define our infrastructure, and the application code is hosted on AWS Lambda. 

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Testing locally
To test the functions locally, you must have NodeJS latest LTS, AWS CLI, AWS SAM, AWS CDK, and Python 3.8, and Docker installed. After those are installed, run the following in the project directory.

```
yarn run synth
```

That will set up NPM and AWS SAM for testing locally. You can then run the lambdas locally with the following:
```
yarn run clipgenerator
yarn run poller
yarn run downloader
yarn run cccfinder
```
