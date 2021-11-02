import fs from "fs-extra";
import { mockClass } from ".";

beforeAll(() => {
  process.env.MOCK_RECORDER = "record";
  fs.removeSync("__tests__");
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

test("recording and replaying non-promise class method", () => {
  let callCount = 0;

  class TestClass {
    public testMethod(a: string, b: Array<string>) {
      callCount++;
      return `${a} and ${b.join(".")}`;
    }
  }

  mockClass(TestClass, "testMethod");

  const testA = new TestClass();

  const retA = testA.testMethod("a", ["b", "c"]);
  const retB = testA.testMethod("a", ["b", "c"]);
  const retC = testA.testMethod("a", ["b", "c"]);
  expect(retA).toBe("a and b.c");
  expect(retB).toBe("a and b.c");
  expect(retC).toBe("a and b.c");

  const testB = new TestClass();
  const retD = testB.testMethod("a", ["b", "c"]);
  expect(retD).toBe("a and b.c");

  // original method call should only happen once
  // even when new class is created.
  expect(callCount).toBe(1);
});

test("recording and replaying promise class method", async () => {
  let callCount = 0;
  class TestPromiseClass {
    public async promiseMethod(a: string, b: Array<string>): Promise<string> {
      callCount++;
      return new Promise((resolve) =>
        setTimeout(() => resolve(`${a} and ${b.join(".")}`), 10)
      );
    }
  }

  mockClass(TestPromiseClass, "promiseMethod");

  const testA = new TestPromiseClass();
  const [retA, retB, retC] = await Promise.all([
    testA.promiseMethod("a", ["b", "c"]),
    testA.promiseMethod("a", ["b", "c"]),
    testA.promiseMethod("a", ["b", "c"]),
  ]);
  // one thing to note is that this library doesn't perform
  // request deduplication. So if you use Promise.all,
  // the call count would be 3 because when those three
  // calls were made, we have no recording at all.
  expect(callCount).toBe(3);

  expect(retA).toBe("a and b.c");
  expect(retB).toBe("a and b.c");
  expect(retC).toBe("a and b.c");

  const testB = new TestPromiseClass();
  const [retD, retE] = await Promise.all([
    testB.promiseMethod("a", ["b", "c"]),
    testB.promiseMethod("a", ["b", "c"]),
  ]);

  // However, after those first three calls,
  // we already have the recording. So, the call count
  // after we have the recording should not increase.
  expect(callCount).toBe(3);

  expect(retD).toBe("a and b.c");
  expect(retE).toBe("a and b.c");
});

test("using different arguments", () => {
  let callCount = 0;

  class TestArguments {
    public testMethod(a: string, b: Array<string>) {
      callCount++;
      return `${a} and ${b.join(".")}`;
    }
  }

  mockClass(TestArguments, "testMethod");

  const testA = new TestArguments();

  const retA = testA.testMethod("a", ["b", "c"]);
  const retB = testA.testMethod("a", ["b", "c"]);
  const retC = testA.testMethod("a", ["b", "d"]);
  expect(retA).toBe("a and b.c");
  expect(retB).toBe("a and b.c");
  expect(retC).toBe("a and b.d");

  const testB = new TestArguments();
  const retD = testB.testMethod("a", ["b", "c"]);
  const retE = testB.testMethod("a", ["b", "d"]);
  expect(retD).toBe("a and b.c");
  expect(retE).toBe("a and b.d");

  expect(callCount).toBe(2);
});

test("using unitTestName to resolve conflict", () => {
  let callCountA = 0;
  let callCountB = 0;
  const A = class ClassWithSameName {
    public testMethod(a: string, b: Array<string>) {
      callCountA++;
      return `${a} and ${b.join(".")}`;
    }
  };

  const B = class ClassWithSameName {
    public testMethod(a: string, b: Array<string>) {
      callCountB++;
      return `${a} and ${b.join(".")}`;
    }
  };

  mockClass(A, "testMethod", { unitTestName: "scope1" });
  mockClass(B, "testMethod", { unitTestName: "scope2" });

  const testA = new A();

  const retA = testA.testMethod("a", ["b", "c"]);
  const retB = testA.testMethod("a", ["b", "c"]);
  expect(retA).toBe("a and b.c");
  expect(retB).toBe("a and b.c");

  expect(callCountA).toBe(1);
  expect(callCountB).toBe(0);

  const testB = new B();

  const retC = testB.testMethod("a", ["b", "c"]);
  const retD = testB.testMethod("a", ["b", "c"]);
  expect(retC).toBe("a and b.c");
  expect(retD).toBe("a and b.c");

  expect(callCountA).toBe(1);
  expect(callCountB).toBe(1);
});

test("restoring the implementation of mocked class", () => {
  let callCount = 0;

  class TestRestore {
    public testMethod(a: string, b: Array<string>) {
      callCount++;
      return `${a} and ${b.join(".")}`;
    }
  }

  const restore = mockClass(TestRestore, "testMethod");

  const testA = new TestRestore();

  const retA = testA.testMethod("a", ["b", "c"]);
  const retB = testA.testMethod("a", ["b", "c"]);
  const retC = testA.testMethod("a", ["b", "c"]);
  expect(retA).toBe("a and b.c");
  expect(retB).toBe("a and b.c");
  expect(retC).toBe("a and b.c");
  expect(callCount).toBe(1);

  restore();
  const retD = testA.testMethod("a", ["b", "c"]);
  expect(retD).toBe("a and b.c");
  expect(callCount).toBe(2);

  const retE = testA.testMethod("a", ["b", "c"]);
  expect(retE).toBe("a and b.c");
  expect(callCount).toBe(3);

  const testB = new TestRestore();
  const retF = testB.testMethod("a", ["b", "c"]);
  expect(retF).toBe("a and b.c");
  expect(callCount).toBe(4);

  const retG = testB.testMethod("a", ["b", "c"]);
  expect(retG).toBe("a and b.c");
  expect(callCount).toBe(5);

  const restore2 = mockClass(TestRestore, "testMethod");

  const testC = new TestRestore();
  const retH = testA.testMethod("a", ["b", "c"]);
  const retI = testB.testMethod("a", ["b", "c"]);
  const retJ = testC.testMethod("a", ["b", "c"]);
  expect(retH).toBe("a and b.c");
  expect(retI).toBe("a and b.c");
  expect(retJ).toBe("a and b.c");

  // because we have recording
  expect(callCount).toBe(5);

  restore2();
  const retK = testA.testMethod("a", ["b", "c"]);
  expect(retK).toBe("a and b.c");
  expect(callCount).toBe(6);
});
