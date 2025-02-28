import fs from 'node:fs';
import { z } from 'zod';

export type ScenarioArtifact = {
    name: string;
    location: string;
    comparisonLocation: string;
};

export type Scenario = {
    image: string;
    commands: string[][];
    artifacts: ScenarioArtifact[];
    description: string;
};

export const scenarioValidator = z.object({
    image: z.string(),
    commands: z.array(z.array(z.string())),
    artifacts: z.array(z.object({
        name: z.string(),
        location: z.string(),
        comparisonLocation: z.string(),
    })),
    description: z.string(),
});

export const scenarioCollectionValidator = z.record(scenarioValidator);

export type ScenarioCollection = {
    [key: string]: Scenario;
};

export function loadScenariosFromFile(scenarioFile: string): ScenarioCollection {
    const fileContents = fs.readFileSync(scenarioFile, 'utf8');
    return JSON.parse(fileContents) as ScenarioCollection;
}