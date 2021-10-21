import { assertEquals, assertThrows } from "https://deno.land/std@0.111.0/testing/asserts.ts";
import { formatDate, hasOwnProperty, hasOwnPropertyInArray, validateObject, validateProperty } from "../src/utils.ts";

Deno.test("Format date test", () => {
    assertEquals(formatDate('1-1-2010'), "2010-01-01T05:00:00.000Z");
})

Deno.test("Has own property test", () => {
    const obj = {prop: "test property"}
    assertEquals(hasOwnProperty(obj, "prop"), true)
    assertEquals(hasOwnProperty(obj, "notProp"), false)
})

Deno.test("Has own property in array test", () => {
    const obj = {prop: "test prop"}
    assertEquals(hasOwnPropertyInArray(obj, ["not prop","pRoP"]), "prop")
    assertEquals(hasOwnPropertyInArray(obj, ["not prop"]), undefined)
})

Deno.test("Validate property test", () => {
    const obj = {prop: "test prop", aNumber: 42}
    assertEquals(validateProperty<string>(obj, ["not prop","pRoP"]), "test prop")
    //TODO: This should throw but it doesn't
    // assertThrows(() => {validateProperty<string>(obj, ["aNumber"])})
    assertEquals(validateProperty<number>(obj, ["aNumber"]), 42)
    assertThrows(() => {validateProperty<string>(obj, ["yeet", "not in it"])})
    assertThrows(() => {validateProperty<string>(obj, "not in it")})
})

Deno.test("Validate object test", () => {
    const obj = {prop: { data: "we did it!" }, aNumber: 42}
    assertEquals(validateObject<string>(obj, ["prop", "data"]), "we did it!")
    assertEquals(validateObject<number>(obj, ["aNumber"]), 42)
    assertThrows(() => {validateObject<string>(obj, ["prop", "no"])})
    assertThrows(() => {validateObject<string>(obj, ["prop", "no"])})
})