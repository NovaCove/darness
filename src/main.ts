#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';

import { join } from 'node:path';

import { Command } from 'commander';

import { Harness } from '.';

const version = JSON.parse(readFileSync(
    join(__dirname, '..', './package.json'),
    'utf8',
))?.version;

const program = new Command();
program
    .name('darness')
    .description('Run scenarios in Docker containers.')
    .version(version);

async function runScenarios(harness: Harness, scenarioNames: string[] = []) {
    await harness.runScenarios(scenarioNames);
}

program
    .command('run')
    .description('Run darness scenarios')
    .option('-c, --config <path>', 'Path to the config file', './darness.config.json')
    .option('-s, --daemon-socket <daemonSocket>', 'Docker daemon socket to connect to')
    .option('-n, --scenarios <scenarios...>', 'List of scenarios to run', [])
    .action(async (options) => {
        const config = {
            config: options.config,
            daemonSocket: options.daemonSocket,
        };

        // Ensure that the config file exists.
        if (!existsSync(config.config)) {
            console.error(`Config file not found: ${config.config}`);
            process.exit(1);
        }
        const harness = new Harness(config);
        try {
            await runScenarios(harness, options.scenarios);
        } catch (e) {
            console.error('Failed to run scenarios: ', e);
            process.exit(1);
        }
        process.exit(0);
    });


program
    .command('validate')
    .option('-c, --config <path>', 'Path to the config file', './darness.config.json')
    .action((options) => {
        // Ensure that the config file exists.
        if (!existsSync(options.config)) {
            console.error(`Config file not found: ${options.config}`);
            process.exit(1);
        }
        // Make sure the config file is valid.
        try {
            const configData = JSON.parse(readFileSync(options.config, 'utf8'));
            if (!Harness.validateConfig(configData)) {
                console.error('Config file is invalid.');
                process.exit(1);
            }

            console.log('Config file is valid.');
        } catch(e) {
            console.error('Failed to validate config file: ', e);
            process.exit(1);
        }
        console.log('Config file is valid.');
        process.exit(0);
    });

program
    .command('list')
    .description('List available scenarios')
    .option('-c, --config <path>', 'Path to the config file', './darness.config.json')
    .action(async (options) => {
        const config = {
            config: options.config,
        };
        // Ensure that the config file exists.
        if (!existsSync(config.config)) {
            console.error(`Config file not found: ${config.config}`);
            process.exit(1);
        }
        const harness = new Harness(config);
        try {
            await harness.listScenarios();
        } catch (e) {
            console.error('Failed to list scenarios: ', e);
            process.exit(1);
        }
        process.exit(0);
    });

program.parse(process.argv);