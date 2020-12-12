import { GameState } from "hivelings/types/simulation";
import { base } from "hivelings/scenarios/base";

export enum ScenarioName {
  BASE = "BASE"
}

export const loadStartingState = (name: ScenarioName): GameState => {
  switch (name) {
    case ScenarioName.BASE:
      return base.startingState;
  }
};
