// Acceptable ranges for watchdog metrics (see mini_CAGE/data/watchdog/*.json).
// In the Evaluation table, a field's average is shown with a green background
// when it falls within [min, max], and red otherwise. Fields not listed here
// are left unstyled (no clear "good" direction to compare against).
export const WATCHDOG_BOUNDS = {
  reward:            { min: -300, max: 0 },
  restore:           { min: 0.4,  max: 1 },
  compromised:       { min: 0,    max: 6 },
  impacts_on_target: { min: 0,    max: 8 },
  remove_efficiency: { min: 0.3,  max: 1 },
  red_success:       { min: 0,    max: 0.75 },
  blue_success:      { min: 0.5,  max: 1 },
};
