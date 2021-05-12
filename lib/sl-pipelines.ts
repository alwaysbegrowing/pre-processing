import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import {Construct, SecretValue, Stack} from '@aws-cdk/core';
import {CdkPipeline, SimpleSynthAction} from '@aws-cdk/pipelines';
import { PreProdStage, ProdStage } from './sl-stages';

export class PreProdPipeline extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();

        const pipeline = new CdkPipeline(this, 'Timestamps', {
            pipelineName: 'PreProd-Timestamps',
            cloudAssemblyArtifact,

            sourceAction: new codepipeline_actions.GitHubSourceAction({
                actionName: 'timestamps-GitHub',
                output: sourceArtifact,
                oauthToken: SecretValue.secretsManager('github-token', {'jsonField': 'chand1012'}),
                owner: 'pillargg',
                repo: 'timestamps',
                branch: 'develop'
            }),

            synthAction: new SimpleSynthAction({
                sourceArtifact: sourceArtifact,
                cloudAssemblyArtifact: cloudAssemblyArtifact,
                buildCommands: ['npm run build'],
                synthCommand: 'cdk synth',
                installCommands: ['npm i -g npm@latest', 'npm i -g aws-cdk', 'npm i'],
                environment: {privileged: true}
            })
        });

        pipeline.addApplicationStage(new PreProdStage(this, 'PreProd'))

    }
}

export class ProdPipeline extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();

        const pipeline = new CdkPipeline(this, 'Timestamps', {
            pipelineName: 'Prod-Timestamps',
            cloudAssemblyArtifact,

            sourceAction: new codepipeline_actions.GitHubSourceAction({
                actionName: 'timestamps-GitHub',
                output: sourceArtifact,
                oauthToken: SecretValue.secretsManager('github-token', {'jsonField': 'chand1012'}),
                owner: 'pillargg',
                repo: 'timestamps',
                branch: 'master'
            }),

            synthAction: new SimpleSynthAction({
                sourceArtifact: sourceArtifact,
                cloudAssemblyArtifact: cloudAssemblyArtifact,
                buildCommands: ['npm run build'],
                synthCommand: 'cdk synth',
                installCommands: ['npm i -g npm@latest', 'npm i -g aws-cdk', 'npm i'],
                environment: {privileged: true}
            })
        });

        pipeline.addApplicationStage(new ProdStage(this, 'Prod'))

    }
}