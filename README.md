# Jest Mock Recorder &bull; [![latest version](https://img.shields.io/npm/v/jest-mock-recorder/latest.svg)](https://www.npmjs.com/package/jest-mock-recorder) [![release](https://github.com/andresusanto/jest-mock-recorder/actions/workflows/release.yml/badge.svg)](https://github.com/andresusanto/jest-mock-recorder/actions/workflows/release.yml)

[![npm status](https://nodei.co/npm/jest-mock-recorder.png)](https://www.npmjs.com/package/jest-mock-recorder)

Inspired by [Nock](https://github.com/nock/nock), this library allows you to record and replay functions (usually libraries) in your jest tests. By doing so, you don't have to mock your dependencies while testing your code without relying on external services.

## Installation

```bash
npm i -S jest-mock-recorder
```

## Usage

The environment variable `MOCK_RECORDER` controls how `jest-mock-recorder` behaves. If it is set to `record`, `jest-mock-recorder` will record and save the calls to the original function. If it is not set, or set to other values, `jest-mock-recorder` will only replay the recorded calls and throw an error if no recorded call for the function is available.

```ts
import { mockClass } from "jest-mock-recorder";
import { ExampleDatabaseClient } from "example-database-client";

beforeAll(() => {
  mockClass(ExampleDatabaseClient, "query"); // <-- just this one line
});

test("getting user from database", async () => {
  ///
  /// .. some code
  ///

  // the ExampleDatabaseClient that is used by your code
  // will be mocked. If there are recordings available, it will use the
  // recording instead of calling the real function. Otherwise,
  // it will call the function and record the returning value.
  await expect(yourFunctionThatUsesDatabaseClient(a, b, c, d)).resolves.toEqual(
    expectedResult
  );
});
```

or if you need to restore the original implementation of the class function:

```ts
import { mockClass } from "jest-mock-recorder";
import { ExampleDatabaseClient } from "example-database-client";

test("getting user from database", async () => {
  const restore = mockClass(ExampleDatabaseClient, "query"); // <-- just this one line
  ///
  /// .. some code
  ///

  // do some test
  await expect(yourFn(a, b, c, d)).resolves.toEqual(expectedResult);

  // need to restore?
  restore();

  //
  // do other stuff here...
  //

  //
  // you can mock it again later:
  const restore2 = mockClass(ExampleDatabaseClient, "query");

  // do other stuff
});
```
