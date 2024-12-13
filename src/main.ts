#!/usr/bin/env node

import { Harness } from '.';

const harness = new Harness();
harness.runScenarios().then(() => {
    console.log('All scenarios completed.');
}).catch((e) => {
    console.error('Error running scenarios: ', e);
});