import { describe, expect, it } from "vitest";
import { splitWorkOrderPhotos } from "./WorkOrders";

describe("Work order photo gallery", () => {
  it("يفصل صور قبل وبعد الصيانة ويتجاهل المرفقات الأخرى", () => {
    const result = splitWorkOrderPhotos([
      { id: 1, kind: "photo", photoSlot: "before", url: "before.jpg" },
      { id: 2, kind: "photo", photoSlot: "after", url: "after.jpg" },
      { id: 3, kind: "audio", url: "voice.webm" },
    ]);

    expect(result.all).toHaveLength(2);
    expect(result.before.map(photo => photo.url)).toEqual(["before.jpg"]);
    expect(result.after.map(photo => photo.url)).toEqual(["after.jpg"]);
  });

  it("يعيد مجموعات فارغة عند وصول قيمة غير مصفوفية", () => {
    expect(splitWorkOrderPhotos(null)).toEqual({ all: [], before: [], after: [] });
    expect(splitWorkOrderPhotos({ kind: "photo" })).toEqual({ all: [], before: [], after: [] });
  });
});
