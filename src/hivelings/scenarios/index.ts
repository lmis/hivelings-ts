import { SimulationState } from "hivelings/types/simulation";
import { makeBaseScenario } from "hivelings/scenarios/base";
import { makeRandomScenario } from "hivelings/scenarios/random";

export enum ScenarioName {
  BASE = "base",
  RANDOM = "random"
}

export const loadStartingState = (name: string): SimulationState => {
  switch (name) {
    case ScenarioName.BASE:
      return makeBaseScenario();
    case ScenarioName.RANDOM:
      return makeRandomScenario();
    default:
      throw new Error(`Unknown Scenario ${name}`);
  }
};
