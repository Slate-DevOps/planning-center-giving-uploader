import { assertEquals } from "https://deno.land/std@0.107.0/testing/asserts.ts";
import { Stub, stub } from "https://deno.land/x/mock@0.10.1/stub.ts";
import { Sources } from "./sources.ts";

Deno.test("Source constructor test", () => {
    const source = new Sources([], "test string");

    assertEquals(source.sources, []);
    assertEquals(source.fetcher.baseURL, "https://api.planningcenteronline.com/giving/v2/payment_sources");
    assertEquals(source.observers, []);
})

Deno.test("Load sources test", async () => {
    const source = new Sources([], "test string");

    const getAll: Stub<Sources> = stub(source, "getAll");
    getAll.returns = [[{id: "test id", attributes: { name: "source name"}}]] 
    await source.loadsources();

    assertEquals(await source.sources, [{id: "test id", name: "source name"}]);
})

Deno.test("Handle source test", async () => {
    const source = new Sources([], "test string");

    const getAll: Stub<Sources> = stub(source, "getAll");
    getAll.returns = [[{id: "22", attributes: { name: "source name"}}]] 
    await source.loadsources();

    assertEquals(source.handleSource("source name"), 22);
    assertEquals(source.handleSource("not ource name"), 2401);
})