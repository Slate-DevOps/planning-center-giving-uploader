import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.107.0/testing/asserts.ts";
import { assertRejects } from "https://deno.land/std@0.111.0/testing/asserts.ts";
import { Stub, stub } from "https://deno.land/x/mock@0.10.1/stub.ts";
import { Batches } from "./batches.ts";

Deno.test("Batch constructor test", () => {
  const batch = new Batches([], "test string");

  assertEquals(batch.batches, []);
  assertEquals(
    batch.fetcher.baseURL,
    "https://api.planningcenteronline.com/giving/v2/batches",
  );
  assertEquals(batch.observers, []);
});

Deno.test("Load batches test", async () => {
  const batch = new Batches([], "test string");

  const getAll: Stub<Batches> = stub(batch, "getAll");
  getAll.returns = [[{
    id: "test id",
    attributes: { description: "batch name" },
  }]];
  await batch.loadBatches();

  assertEquals(await batch.batches, [{ id: "test id", name: "batch name" }]);
});

Deno.test("Handle batch test", async () => {
  const batch = new Batches([], "test string");

  const getAll: Stub<Batches> = stub(batch, "getAll");
  getAll.returns = [[{ id: "22", attributes: { description: "batch name" } }]];
  await batch.loadBatches();

  assertEquals(await batch.handleBatch("batch name"), "22");

  const postNew: Stub<Batches> = stub(batch, "postNew");
  postNew.returns = [{
    data: { id: "100", attributes: { description: "test batch" } },
  }];

  assertEquals(await batch.handleBatch("not batch name"), "100");
  assertEquals(await batch.handleBatch("not a batch"), undefined);
});

Deno.test("Make new batch test", async () => {
  const batch = new Batches([], "test string");

  const postNew: Stub<Batches> = stub(batch, "postNew");
  postNew.returns = [undefined];
  assertRejects(async () => {
    await batch.makeNewBatch("test batch");
  });
  postNew.returns = [{
    data: { id: "100", attributes: { description: "test batch" } },
  }];

  assertEquals(await batch.makeNewBatch("test batch"), {
    id: "100",
    name: "test batch",
  });

  postNew.returns = [{ data: { id: "100" } }];
  assertRejects(async () => {
    await batch.makeNewBatch("test batch");
  });
});
