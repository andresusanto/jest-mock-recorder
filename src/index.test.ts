import fs from "fs-extra";
import { mockClass, mockObject } from ".";

beforeAll(() => {
  fs.removeSync("__tests__");
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

beforeEach(() => {
  process.env.MOCK_RECORDER = "record";
});

test("throwing error when given invalid input", () => {
  const TestObject = {
    testMethod: null as unknown as (x: any) => any,
  };

  expect(() => mockObject(TestObject, "testMethod")).toThrowError(
    "Method Object.testMethod not found"
  );
});

test("throwing error when mode is not record and no recording is found", () => {
  process.env.MOCK_RECORDER = undefined;

  class TestClass {
    public testMethod(a: string, b: Array<string>) {}
  }

  mockClass(TestClass, "testMethod");

  const testA = new TestClass();

  expect(() => testA.testMethod("a", ["b", "c"])).toThrow(
    'MOCK_RECORDER is not set to "record" but no recording found for TestClass.testMethod with args ["a",["b","c"]].'
  );
  expect(() =>
    testA.testMethod("a", [
      "b",
      "c",
      "asdsadsadasdsadsadsdasdasdsadsadsadsadsaasddasadsdasasd",
    ])
  ).toThrow(
    'MOCK_RECORDER is not set to "record" but no recording found for TestClass.testMethod with args ["a",["b","c","asdsa....'
  );
});

test("throwing error when given invalid input", () => {
  const TestObject = {
    testMethod: null as unknown as (x: any) => any,
  };
  class TestClass {
    public testMethod: (x: any) => any = null as any;
  }

  expect(() => mockObject(TestObject, "testMethod")).toThrowError(
    "Method Object.testMethod not found"
  );
  expect(() => mockClass(TestClass, "testMethod")).toThrowError(
    "Method TestClass.testMethod not found"
  );
});

test("using custom args serializer", () => {
  let callCount = 0;
  class TestCustomArgsSerializer {
    public testMethod(a: string) {
      callCount++;
      return { a };
    }
  }

  mockClass(TestCustomArgsSerializer, "testMethod", {
    argsSerializer: ([a]) => {
      return `custom-${a}`;
    },
  });

  const testA = new TestCustomArgsSerializer();
  const retA = testA.testMethod("a");
  const retB = testA.testMethod("b");
  const retC = testA.testMethod("a");
  expect(retA).toEqual({ a: "a" });
  expect(retB).toEqual({ a: "b" });
  expect(retC).toEqual({ a: "a" });
  expect(callCount).toBe(2);
});

test("serialization of non-promise method", () => {
  let callCount = 0;
  class TestSerializationNonPromise {
    public testMethod(a: string) {
      callCount++;
      return { a: new Error(a) };
    }
  }

  mockClass(TestSerializationNonPromise, "testMethod", {
    serDe: {
      serializer: ({ a }) => {
        return a.message;
      },
      deserializer: (input) => {
        return { a: new Error(input) };
      },
    },
  });

  const testA = new TestSerializationNonPromise();
  const retA = testA.testMethod("a");
  const retB = testA.testMethod("b");
  const retC = testA.testMethod("a");
  expect(retA).toEqual({ a: new Error("a") });
  expect(retB).toEqual({ a: new Error("b") });
  expect(retC).toEqual({ a: new Error("a") });
  expect(callCount).toBe(2);
});

test("serialization of promise method", async () => {
  let callCount = 0;
  class TestSerializationPromise {
    public async testMethod(a: string) {
      callCount++;
      return { a: Promise.resolve(a) };
    }
  }

  mockClass(TestSerializationPromise, "testMethod", {
    serDe: {
      serializer: async (input) => {
        const { a } = await input;
        return a;
      },
      deserializer: (input) => {
        return Promise.resolve({ a: Promise.resolve(input) });
      },
    },
  });

  const testA = new TestSerializationPromise();
  const retA = await testA.testMethod("a");
  const retB = await testA.testMethod("b");
  const retC = await testA.testMethod("a");
  const retD = await testA.testMethod("b");
  expect(retA).toEqual({ a: Promise.resolve("a") });
  expect(retB).toEqual({ a: Promise.resolve("b") });
  expect(retC).toEqual({ a: Promise.resolve("a") });
  expect(retD).toEqual({ a: Promise.resolve("b") });
  expect(callCount).toBe(2);
});

test("using async serializer for non promise method", () => {
  let callCount = 0;
  class TestInvalidAsyncSerializer {
    public testMethod(a: string) {
      callCount++;
      return { a: new Error(a) };
    }
  }

  mockClass(TestInvalidAsyncSerializer, "testMethod", {
    serDe: {
      serializer: async ({ a }) => {
        return a.message;
      },
      deserializer: (input) => {
        return { a: new Error(input) };
      },
    },
  });

  const testA = new TestInvalidAsyncSerializer();
  expect(() => testA.testMethod("a")).toThrowError(
    "Promise based serializer only supported when the original function returned Promise."
  );
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

test("restoring the implementation of mocked object", () => {
  let callCount = 0;

  const TestObject = {
    testMethod(a: string, b: Array<string>) {
      callCount++;
      return `${a} and ${b.join(".")}`;
    },
  };

  const restore = mockObject(TestObject, "testMethod");

  const retA = TestObject.testMethod("a", ["b", "c"]);
  const retB = TestObject.testMethod("a", ["b", "c"]);
  const retC = TestObject.testMethod("a", ["b", "c"]);
  expect(retA).toBe("a and b.c");
  expect(retB).toBe("a and b.c");
  expect(retC).toBe("a and b.c");
  expect(callCount).toBe(1);

  restore();
  const retD = TestObject.testMethod("a", ["b", "c"]);
  expect(retD).toBe("a and b.c");
  expect(callCount).toBe(2);

  const retE = TestObject.testMethod("a", ["b", "c"]);
  expect(retE).toBe("a and b.c");
  expect(callCount).toBe(3);

  const retF = TestObject.testMethod("a", ["b", "c"]);
  expect(retF).toBe("a and b.c");
  expect(callCount).toBe(4);

  const retG = TestObject.testMethod("a", ["b", "c"]);
  expect(retG).toBe("a and b.c");
  expect(callCount).toBe(5);

  const restore2 = mockObject(TestObject, "testMethod");

  const retH = TestObject.testMethod("a", ["b", "c"]);
  const retI = TestObject.testMethod("a", ["b", "c"]);
  const retJ = TestObject.testMethod("a", ["b", "c"]);
  expect(retH).toBe("a and b.c");
  expect(retI).toBe("a and b.c");
  expect(retJ).toBe("a and b.c");

  // because we have recording
  expect(callCount).toBe(5);

  restore2();
  const retK = TestObject.testMethod("a", ["b", "c"]);
  expect(retK).toBe("a and b.c");
  expect(callCount).toBe(6);
});
