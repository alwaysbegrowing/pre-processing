#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { SlStack } from "../lib/sl-stack";

const app = new cdk.App();

// development "hack stack"
// this one can be changed at will
new SlStack(app, "Dev-Timestamps", "dev");

// production stack
// DO NOT TOUCH
// Will deploy with CI/CD
new SlStack(app, "Prod-Timestamps", "pillar");

app.synth();
