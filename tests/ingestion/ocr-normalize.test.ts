import { describe, it, expect } from "vitest";
import { normalizeCategory } from "@/lib/ingestion/ocr";

describe("normalizeCategory", () => {
  it("matches sneakers", () => {
    expect(normalizeCategory("Nike Sneakers size 10")).toBe("Shoes");
  });

  it("matches shoes", () => {
    expect(normalizeCategory("Jordan 1 Shoes")).toBe("Shoes");
  });

  it("matches tops/hoodie", () => {
    expect(normalizeCategory("Vintage Hoodie Medium")).toBe("Tops");
  });

  it("matches t-shirt", () => {
    expect(normalizeCategory("Supreme T-Shirt Tee")).toBe("Tops");
  });

  it("matches jeans", () => {
    expect(normalizeCategory("Levi's Jeans 32x30")).toBe("Bottoms");
  });

  it("matches pants", () => {
    expect(normalizeCategory("Cargo Pants Black XL")).toBe("Bottoms");
  });

  it("matches dress", () => {
    expect(normalizeCategory("Floral Dress Size S")).toBe("Dresses");
  });

  it("matches handbag", () => {
    expect(normalizeCategory("Louis Vuitton Handbag")).toBe("Bags");
  });

  it("matches video games", () => {
    expect(normalizeCategory("PS5 Video Game Bundle")).toBe("Video Games");
  });

  it("matches trading cards", () => {
    expect(normalizeCategory("Pokémon Trading Cards Lot")).toBe("Trading Cards");
  });

  it("returns undefined for unknown category", () => {
    expect(normalizeCategory("Random Unrecognized Item")).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(normalizeCategory("SNEAKERS Nike")).toBe("Shoes");
  });

  it("handles empty string", () => {
    expect(normalizeCategory("")).toBeUndefined();
  });
});
