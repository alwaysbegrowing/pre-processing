#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { SlStack } from '../lib/sl-stack';
import { PreProdPipeline, ProdPipeline } from '../lib/sl-pipelines';

const app = new cdk.App();
new SlStack(app, 'SlStack');

new PreProdPipeline(app, 'PreProdTimestampsPipeline');

new ProdPipeline(app, 'ProdTimestampsPipeline');

new SlStack(app, 'ProdTimestampsStack');

new SlStack(app, 'QATimestampsStack');

app.synth();