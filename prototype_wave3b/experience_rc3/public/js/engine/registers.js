const notYet = name => class {
  constructor() {
    throw new Error(`${name} is a B extension point; not built in Wave 3B-1`);
  }
};
export const RinkRegister = notYet('RinkRegister');
export const RaceRegister = notYet('RaceRegister');
export const PossessionThread = notYet('PossessionThread');
export const Pin = notYet('Pin');
export const PullOut = notYet('PullOut');
