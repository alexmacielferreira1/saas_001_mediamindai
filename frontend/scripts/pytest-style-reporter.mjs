import { DefaultReporter } from 'vitest/node';
import { relative } from 'node:path';

// Retain Vitest's error and coverage summaries, without a live queue display.
export default class PytestStyleReporter extends DefaultReporter {
  constructor() {
    super({ isTTY: false, summary: false });
  }

  onTestCaseResult(test) {
    const state = test.result().state;
    const status = { passed: 'PASSED', failed: 'FAILED', skipped: 'SKIPPED', pending: 'PENDING' }[state] || state.toUpperCase();
    const file = relative(process.cwd(), test.module.moduleId).replaceAll('\\', '/');
    const duration = test.diagnostic()?.duration;
    console.log(`${file}::${test.fullName} ${status}${duration == null ? '' : ` (${Math.round(duration)} ms)`}`);
  }
}
