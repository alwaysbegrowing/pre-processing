import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as iam from '@aws-cdk/aws-iam'
import * as secrets from '@aws-cdk/aws-secretsmanager'
import { Construct } from '@aws-cdk/core';
import { CdkPipeline } from '@aws-cdk/pipelines';

// from https://github.com/aws/aws-cdk/issues/10999#issuecomment-771956318

export function AddDockerLogin(scope: Construct, pipeline: CdkPipeline) {
    let assetStage: codepipeline.IStage;
    try {
      assetStage = pipeline.stage('Assets');
    } catch {
      // If a stage with a given name cannot be found, CDK throws an exception
      return;
    }
  
    const dockerAssetActions = assetStage.actions.filter((action) => {
      const actionProperties = action.actionProperties;
      return actionProperties.actionName.startsWith('Docker');
    });
  
    if (dockerAssetActions.length === 0) {
      return;
    }
  
    // Replace the last parameter with the name of your secret.
    // This secret is the access token for a paid dockerhub user
    // https://docs.docker.com/docker-hub/access-tokens/
    const dockerHubSecret = secrets.Secret.fromSecretNameV2(scope, 'SharedSecretImport', 'shared/dockerhub-access-token');
    const secretAccessPolicy = new iam.Policy(scope, 'SecretAccessPolicy', {
      statements: [
        new iam.PolicyStatement({
          sid: 'AllowFetchingDockerHubSecret',
          actions: ['secretsmanager:GetSecretValue'],
          resources: [`${dockerHubSecret.secretArn}-??????`],
        }),
      ],
    });
  
    dockerAssetActions.forEach((action) => {
      const publishAction = action as any;
      const codeBuildProject = publishAction.node.defaultChild.node.defaultChild;
      codeBuildProject.environment.environmentVariables = codeBuildProject.environment.environmentVariables ?? [];
      codeBuildProject.environment.environmentVariables.push({
        name: 'DOCKER_AUTH_TOKEN',
        type: 'SECRETS_MANAGER',
        value: dockerHubSecret.secretName,
      });
      secretAccessPolicy.attachToRole(action.actionProperties.role!);
  
      const commands: string[] = publishAction.commands;
      const command = 'echo ${DOCKER_AUTH_TOKEN} | docker login --username chand1012 --password-stdin';
      if (!commands.includes(command)) {
        // login needs to happen before the asset publication (that's where docker images are built)
        commands.unshift(command);
      }
    });
  }