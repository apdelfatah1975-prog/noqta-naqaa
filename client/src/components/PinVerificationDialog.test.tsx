import { describe, expect, it } from "vitest";
import { shouldForwardDialogChange } from "./PinVerificationDialog";

describe("حارس تغييرات حالة حوار التحقق", () => {
  it("يمرر الانتقال الحقيقي فقط", () => {
    expect(shouldForwardDialogChange(false, true)).toBe(true);
    expect(shouldForwardDialogChange(true, false)).toBe(true);
  });

  it("يرفض إعادة تمرير القيمة الحالية حتى لا تبدأ حلقة تحديث", () => {
    expect(shouldForwardDialogChange(false, false)).toBe(false);
    expect(shouldForwardDialogChange(true, true)).toBe(false);
  });
});
