/**
 * Builds cucumber messages and provides them as stream.
 * Used as a singleton.
 */

import * as pw from '@playwright/test/reporter';
import * as messages from '@cucumber/messages';
import { FeaturesLoader } from '../../../cucumber/loadFeatures';
import { getPlaywrightConfigDir } from '../../../config/dir';
import { TestCaseRun, TestCaseRunEnvelope } from './TestCaseRun';
import { TestCase } from './TestCase';
import { Meta } from './Meta';
import { TimeMeasured, calcMinMaxByArray, toCucumberTimestamp } from './timing';
import EventEmitter from 'node:events';
import EventDataCollector from '../helpers/EventDataCollector';
import { Hook } from './Hook';
import { MapWithCreate } from '../../../utils/MapWithCreate';

export type MessagesBuilderRef = ReturnType<typeof getMessagesBuilderRef>;

let instance: MessagesBuilder;
let referenceCount = 0;

/**
 * Returns reference to messagesBuilder singleton instance.
 * We pass onTestEnd and onEnd calls only for the first reference (reporter),
 * otherwise all events will be duplicated.
 */
export function getMessagesBuilderRef() {
  if (!instance) instance = new MessagesBuilder();
  const isFirstRef = ++referenceCount === 1;
  return {
    builder: instance,
    onTestEnd(test: pw.TestCase, result: pw.TestResult) {
      isFirstRef && this.builder.onTestEnd(test, result);
    },
    onEnd(fullResult: pw.FullResult) {
      isFirstRef && this.builder.onEnd(fullResult);
    },
  };
}

type ConcreteEnvelope<T extends keyof messages.Envelope> = Required<
  Pick<messages.Envelope, T>
> | null;

class MessagesBuilder {
  private report = {
    meta: null as ConcreteEnvelope<'meta'>,
    source: [] as ConcreteEnvelope<'source'>[],
    gherkinDocument: [] as ConcreteEnvelope<'gherkinDocument'>[],
    pickle: [] as ConcreteEnvelope<'pickle'>[],
    stepDefinition: [] as ConcreteEnvelope<'stepDefinition'>[],
    hook: [] as ConcreteEnvelope<'hook'>[],
    testRunStarted: null as ConcreteEnvelope<'testRunStarted'>,
    testCase: [] as ConcreteEnvelope<'testCase'>[],
    testCaseRuns: [] as TestCaseRunEnvelope[],
    testRunFinished: null as ConcreteEnvelope<'testRunFinished'>,
  };

  private fullResult!: pw.FullResult;
  private onTestEnds: { test: pw.TestCase; result: pw.TestResult }[] = [];
  private testCaseRuns: TestCaseRun[] = [];
  private testCases = new MapWithCreate</* testId */ string, TestCase>();
  private hooks = new MapWithCreate</* internalId */ string, Hook>();
  private featuresLoader = new FeaturesLoader();
  private fullResultTiming?: TimeMeasured;
  private onEndPromise: Promise<void>;
  private onEndPromiseResolve = () => {};
  private buildMessagesPromise?: Promise<void>;

  private eventDataCollectorEmitter = new EventEmitter();
  public eventDataCollector = new EventDataCollector(this.eventDataCollectorEmitter);

  constructor() {
    this.onEndPromise = new Promise((resolve) => (this.onEndPromiseResolve = resolve));
  }

  onTestEnd(test: pw.TestCase, result: pw.TestResult) {
    this.onTestEnds.push({ test, result });
  }

  onEnd(fullResult: pw.FullResult) {
    this.fullResult = fullResult;
    this.onEndPromiseResolve();
  }

  /**
   * Builds Cucumber messages.
   * Note: wrapped into promise to build messages once for all reporters.
   */
  async buildMessages() {
    if (!this.buildMessagesPromise) this.buildMessagesPromise = this.doBuildMessages();
    return this.buildMessagesPromise;
  }

  // eslint-disable-next-line max-statements
  private async doBuildMessages() {
    await this.onEndPromise;

    this.createTestCaseRuns();
    await this.loadFeatures();
    this.createTestCases();

    this.addMeta();
    this.addSources();
    this.addGherkinDocuments();
    this.addPickles();
    this.addHooks();
    this.addTestRunStarted();
    this.addTestCases();
    this.addTestCaseRuns();
    this.addTestRunFinished();

    this.buildEventDataCollector();
  }

  emitMessages(eventBroadcaster: EventEmitter) {
    Object.values(this.report).forEach((value) => {
      if (!value) return;
      const messages = Array.isArray(value) ? value : [value];
      messages.forEach((message) => eventBroadcaster.emit('envelope', message));
    });
  }

  private getFeaturePaths() {
    const featurePaths = new Set<string>();
    this.testCaseRuns.forEach((testCaseRun) => featurePaths.add(testCaseRun.bddData.uri));
    return [...featurePaths];
  }

  private async loadFeatures() {
    const cwd = getPlaywrightConfigDir();
    const featurePaths = this.getFeaturePaths();
    await this.featuresLoader.load(featurePaths, { relativeTo: cwd });
  }

  private createTestCases() {
    const gherkinDocuments = this.featuresLoader.getDocumentsWithPickles();
    this.testCaseRuns.forEach((testCaseRun) => {
      const testId = testCaseRun.test.id;
      const testCase = this.testCases.getOrCreate(
        testId,
        () => new TestCase(testId, gherkinDocuments),
      );
      testCase.addRun(testCaseRun);
      testCaseRun.testCase = testCase;
    });
  }

  private createTestCaseRuns() {
    this.onTestEnds.forEach(({ test, result }) => {
      const testCaseRun = new TestCaseRun(test, result, this.hooks);
      this.testCaseRuns.push(testCaseRun);
    });
  }

  private addMeta() {
    this.report.meta = new Meta().buildMessage();
  }

  private addSources() {
    this.report.source = this.featuresLoader.gherkinQuery
      .getSources()
      .map((source) => ({ source }));
  }

  private addGherkinDocuments() {
    this.report.gherkinDocument = this.featuresLoader.gherkinQuery
      .getGherkinDocuments()
      .map((gherkinDocument) => ({ gherkinDocument }));
  }

  private addPickles() {
    this.report.pickle = this.featuresLoader.gherkinQuery
      .getPickles()
      .map((pickle) => ({ pickle }));
  }

  private addHooks() {
    this.hooks.forEach((hook) => {
      const message = hook.buildMessage();
      this.report.hook.push(message);
    });
  }

  private addTestCases() {
    this.testCases.forEach((testCase) => {
      const message = testCase.buildMessage();
      this.report.testCase.push(message);
    });
  }

  private addTestCaseRuns() {
    this.testCaseRuns.map((testCaseRun) => {
      const messages = testCaseRun.buildMessages();
      this.report.testCaseRuns.push(...messages);
    });
  }

  private addTestRunStarted() {
    const { startTime } = this.getFullResultTiming();
    const testRunStarted: messages.TestRunStarted = {
      timestamp: toCucumberTimestamp(startTime.getTime()),
    };
    this.report.testRunStarted = { testRunStarted };
  }

  private addTestRunFinished() {
    const { startTime, duration } = this.getFullResultTiming();
    const testRunFinished: messages.TestRunFinished = {
      success: this.fullResult.status === 'passed',
      timestamp: toCucumberTimestamp(startTime.getTime() + duration),
    };
    this.report.testRunFinished = { testRunFinished };
  }

  private buildEventDataCollector() {
    this.emitMessages(this.eventDataCollectorEmitter);
  }

  private getFullResultTiming() {
    if (this.fullResultTiming) return this.fullResultTiming;
    // result.startTime and result.duration were added in pw 1.37
    // see: https://github.com/microsoft/playwright/pull/26760
    if ('startTime' in this.fullResult && 'duration' in this.fullResult) {
      this.fullResultTiming = {
        startTime: this.fullResult.startTime as Date,
        duration: this.fullResult.duration as number,
      };
    } else {
      // Calculate overall startTime and duration based on test timings
      const items = this.testCaseRuns.map((t) => t.result);
      this.fullResultTiming = calcMinMaxByArray(items);
    }

    return this.fullResultTiming;
  }
}
