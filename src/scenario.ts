import fs from 'node:fs';

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

export type ScenarioCollection = {
    [key: string]: Scenario;
};

export function loadScenariosFromFile(scenarioFile: string): ScenarioCollection {
    const fileContents = fs.readFileSync(scenarioFile, 'utf8');
    return JSON.parse(fileContents) as ScenarioCollection;
}