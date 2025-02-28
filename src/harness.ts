import fs from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as tar from 'tar';


import Docker, { Container, type DockerOptions } from 'dockerode';
import { type Scenario, ScenarioArtifact, loadScenariosFromFile, scenarioCollectionValidator } from './scenario';

const DEFAULT_CONFIG_FILE_LOCATION = './darness.config.json';

export type HarnessConfig = {
    config: string;
    daemonSocket?: string;
};

export class Harness {
    private client: Docker;
    

    constructor(private config: HarnessConfig) {
        let dockerOptions: DockerOptions | undefined = undefined;
        if (config.daemonSocket) {
            dockerOptions = {
                socketPath: config.daemonSocket,
            };
        }
        this.client = new Docker(dockerOptions);
    }

    private loadScenarios() {
        try {
            return loadScenariosFromFile(this.config.config);
        } catch (e) {
            console.error('Failed to load scenarios: ', e);
            return {};
        }
    }

    async listScenarios() {
        const scenarios = this.loadScenarios();
        if (Object.keys(scenarios).length === 0) {
            console.log('No scenarios found.');
            return;
        }

        console.log('Available scenarios:');
        for (const scenarioName in scenarios) {
            const scenario = scenarios[scenarioName];
            console.log(`- ${scenarioName}: ${scenario.description}`);
        }
    }

    async runScenarios(scenarioNames: string[] = []) {
        let scenarios = this.loadScenarios();

        if (scenarioNames.length > 0) {
            scenarios = Object.fromEntries(
                Object.entries(scenarios).filter(([name]) => scenarioNames.includes(name))
            );
        }

        for (const scenarioName in scenarios) {
            const scenario = scenarios[scenarioName];

            try {
                await this.runScenario(scenarioName, scenario);
            } catch (e) {
                console.error(`Scenario ${scenarioName} failed: `, e);
            }

            console.log(`Scenario ${scenarioName} completed.`);
        }
    }

    protected async runScenario(scenarioName: string, scenario: Scenario) {
        console.log(`Running scenario: ${scenarioName}`);
        console.log(`Description: ${scenario.description}`);

        console.log(`Creating container with image: ${scenario.image}`);
        const container = await this.client.createContainer({
            Image: scenario.image,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            // platform: 'linux/arm64',
            Entrypoint: ['/bin/sh'],
        });
        console.log(`Created container: ${container.id}`);

        console.log(`Starting container: ${container.id}`);
        await container.start({});
        console.log(`Started container: ${container.id}`);

        // Run each command successfilly in the container.
        for (const command of scenario.commands) {
            const exec = await container.exec({
                Cmd: command,
                AttachStdout: true,
                AttachStderr: true,
            });
            const stream = await exec.start({});
            const output = await new Promise<string>((resolve, reject) => {
                let output = '';
                stream.on('data', (chunk) => {
                    output += chunk.toString();
                });
                stream.on('end', () => {
                    resolve(output);
                });
                stream.on('error', (err) => {
                    reject(err);
                });
            });
            console.log(`Command: ${command} output: ${output}`);
        }

        // Collect artifacts.
        for (const artifact of scenario.artifacts) {
            try {
                await this.indianaJonesThatTreasure(artifact, container);
            } catch (err) {
                console.error(`Failed to collect artifact: ${artifact.name}`, err);
            }
        }

        // Clean up.
        console.log(`Stopping container: ${container.id}`);
        await container.stop();

        console.log(`Removing container: ${container.id}`);
        await container.remove({ force: true });
    }

    async indianaJonesThatTreasure(artifact: ScenarioArtifact, container: Container) {
        const containerPath = artifact.location;
        const hostPath = artifact.comparisonLocation;
        const stream = await container.getArchive({ path: containerPath });

        // Make a temp path to store the file at
        // so we can compare it to the expected file.
        const tempDir = await mkdtemp(join(tmpdir(), 'harness-'));
        const tempPath = `${tempDir}/${artifact.name}`;
        const tarPath = `${tempDir}/${artifact.name}.tar`;

        console.log(`Saving artifact: ${artifact.name} to ${tempPath}`);

        await new Promise((resolve, reject) => {
            stream.pipe(fs.createWriteStream(tarPath));
            stream.on('end', resolve);
            stream.on('error', reject);
        });

        // Extract the file from the tarball.
        await new Promise((resolve, reject) => {
            console.log(`Extracting artifact: ${artifact.name} to ${tempPath}`);
            const tarStream = fs.createReadStream(tarPath);
            tarStream.on('error', reject);

            // DIDNTDO(ttacon): we should support extracting only a single file, 
            // but it also shouldn't matter since there _should_ only be a single file
            // in the tarball.
            tarStream.pipe(tar.extract({
                cwd: tempDir,
                C: tempDir,
            })).on('finish', resolve);
        });

        console.log(`Artifact: ${artifact.name} saved to ${tempPath}`);

        // Compare the file with the expected file.
        const expected = fs.readFileSync(hostPath, 'utf8');
        const actual = fs.readFileSync(tempPath, 'utf8');
        if (expected !== actual) {
            console.error(`Artifact ${artifact.name} does not match expected contents.`);
        }
    }

    static validateConfig(config: Record<string, unknown>) {
        return scenarioCollectionValidator.safeParse(config).success;
    }
}