import { SimulationState } from "hivelings/types/simulation";
import { makeBaseScenario } from "hivelings/scenarios/base";
import { makeRandomScenario } from "hivelings/scenarios/random";

export enum ScenarioName {
  BASE = "BASE",
  RANDOM = "RANDOM"
}

export const loadStartingState = (name: ScenarioName): SimulationState => {
  switch (name) {
    case ScenarioName.BASE:
      return makeBaseScenario();
    case ScenarioName.RANDOM:
      return makeRandomScenario();
  }
};
