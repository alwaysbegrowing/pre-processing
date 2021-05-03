import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import {Construct, SecretValue, Stack} from '@aws-cdk/core';
import {CdkPipeline, SimpleSynthAction} from '@aws-cdk/pipelines';

export class PreProdPipeline extends Stack {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();

        const pipeline = new CdkPipeline(this, 'Timestamps', {
            pipelineName: 'PreProd-Timetamps',
            cloudAssemblyArtifact,

            sourceAction: new codepipeline_actions.GitHubSourceAction({
                actionName: 'timestamps-GitHub',
                output: sourceArtifact,
                oauthToken: SecretValue.secretsManager('github-token', {'jsonField': 'chand1012'}),
                owner: 'pillargg',
                repo: 'timestamps',
                branch: 'develop'
            }),

            synthAction: SimpleSynthAction.standardNpmSynth({
                sourceArtifact,
                cloudAssemblyArtifact,
                buildCommand: 'npm run build'
            })
        });

        
    }
}