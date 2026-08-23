export type BackupFeedbackInput = {
  downloaded: boolean;
  customers: number;
  visits: number;
};

export function getBackupSuccessCopy({ downloaded, customers, visits }: BackupFeedbackInput) {
  return downloaded
    ? {
        title: "تم تنزيل النسخة الاحتياطية Excel بنجاح",
        description: `${customers} عميل و${visits} زيارة محفوظة في النسخة الحالية.`,
      }
    : {
        title: "تم إنشاء النسخة الاحتياطية بنجاح",
        description: `${customers} عميل و${visits} زيارة جاهزة للحفظ.`,
      };
}
