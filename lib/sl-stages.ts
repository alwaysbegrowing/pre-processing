// based on https://aws.amazon.com/blogs/developer/cdk-pipelines-continuous-delivery-for-aws-cdk-applications/

import {CfnOutput, Construct, Stage} from '@aws-cdk/core';
import { SlStack } from './sl-stack';

// deployable stage

export class PreProdStage extends Stage {
    public readonly urlOutput: CfnOutput;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        //const service = new SlStack(this, 'PreProd');
        new SlStack(this, 'PreProd-Timestamps', 'preprod');

    }
}

export class ProdStage extends Stage {
    public readonly urlOutput: CfnOutput;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        //const service = new SlStack(this, 'PreProd');
        new SlStack(this, 'Prod-Timestamps', 'pillar');

    }
}


