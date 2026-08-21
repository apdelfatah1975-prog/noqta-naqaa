import { describe, expect, it } from "vitest";
import { parseWhatsAppLocationText } from "./locationParser";

describe("parseWhatsAppLocationText", () => {
  it("extracts coordinates pasted directly from a WhatsApp location", () => {
    expect(parseWhatsAppLocationText("24.7136, 46.6753")).toMatchObject({
      latitude: "24.7136",
      longitude: "46.6753",
      source: "coordinates",
    });
  });

  it("extracts coordinates from a Google Maps q URL", () => {
    expect(parseWhatsAppLocationText("https://www.google.com/maps?q=24.7136,46.6753")).toMatchObject({
      latitude: "24.7136",
      longitude: "46.6753",
      source: "google_maps_url",
    });
  });

  it("extracts coordinates from the @ segment used by Google Maps URLs", () => {
    expect(parseWhatsAppLocationText("https://www.google.com/maps/@24.7136,46.6753,17z")).toMatchObject({
      latitude: "24.7136",
      longitude: "46.6753",
      source: "google_maps_url",
    });
  });

  it("keeps a short Google Maps link without pretending it has coordinates", () => {
    expect(parseWhatsAppLocationText("https://maps.app.goo.gl/example")).toMatchObject({
      latitude: null,
      longitude: null,
      source: "google_maps_url",
    });
  });

  it("rejects invalid latitude and longitude ranges", () => {
    expect(parseWhatsAppLocationText("124.5, 46.6")).toMatchObject({
      latitude: null,
      longitude: null,
      source: "text",
    });
  });
});
