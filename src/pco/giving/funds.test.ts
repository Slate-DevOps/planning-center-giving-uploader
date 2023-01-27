import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.107.0/testing/asserts.ts";
import { Stub, stub } from "https://deno.land/x/mock@0.10.1/stub.ts";
import { Funds } from "./funds.ts";

Deno.test("Fund constructor test", () => {
  const fund = new Funds([], "test string");

  assertEquals(fund.funds, []);
  assertEquals(
    fund.fetcher.baseURL,
    "https://api.planningcenteronline.com/giving/v2/funds",
  );
  assertEquals(fund.observers, []);
});

Deno.test("Load funds test", async () => {
  const fund = new Funds([], "test string");

  const getAll: Stub<Funds> = stub(fund, "getAll");
  getAll.returns = [[{ id: "test id", attributes: { name: "fund name" } }]];
  await fund.loadfunds();

  assertEquals(await fund.funds, [{ id: "test id", name: "fund name" }]);
});

Deno.test("Handle fund test", async () => {
  const fund = new Funds([], "test string");

  const getAll: Stub<Funds> = stub(fund, "getAll");
  getAll.returns = [[{ id: "22", attributes: { name: "fund name" } }]];
  await fund.loadfunds();

  assertEquals(fund.handleFund("fund name"), 22);
  assertThrows(() => {
    fund.handleFund("not fund name");
  });
});
