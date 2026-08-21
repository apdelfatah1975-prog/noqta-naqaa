# خيارات النسخ الاحتياطي السحابي

## خلاصة موثقة
- Google Cloud SQL for MySQL يدعم نسخًا عند الطلب ونسخًا آلية مجدولة، والنسخ مشفرة افتراضيًا. يمكن الاحتفاظ بالنسخ بعد حذف المثيل، كما يدعم الاستعادة إلى نقطة زمنية PITR عند تفعيل النسخ والتسجيل الثنائي.
- النسخ الاحتياطي ليس هو نفسه التصدير؛ النسخ يديرها مزود الخدمة، بينما التصدير إلى Cloud Storage يحتاج إدارة دورة حياة مستقلة.
- PITR في Cloud SQL ينشئ مثيلًا جديدًا عند الاستعادة، ولا يعيد مباشرة إلى مثيل قائم.
- Supabase يوفّر نسخًا يومية للخطط المدفوعة، ويوصي في الخطة المجانية بالتصدير المنتظم خارج المنصة. نسخ قاعدة البيانات لا تشمل الملفات المخزنة عبر Storage API، ولا يمنع حذف المشروع حذف النسخ المرتبطة به.

## المصادر الرسمية
[1] Google Cloud SQL backups overview: https://docs.cloud.google.com/sql/docs/mysql/backup-recovery/backups
[2] Google Cloud SQL point-in-time recovery: https://docs.cloud.google.com/sql/docs/mysql/backup-recovery/pitr
[3] Supabase Database Backups: https://supabase.com/docs/guides/platform/backups

## توصية للمشروع
بما أن نقطة نقاء مبنية على MySQL/TiDB، فالمسار الأقل مخاطرة هو قاعدة MySQL سحابية متوافقة، مع نسخ آلية مشفرة، ونسخة تصدير دورية مستقلة في تخزين منفصل، واختبار استعادة دوري. لا توجد آلية تضمن عدم فقدان أي بيانات بنسبة 100%؛ الهدف العملي هو تقليل احتمال الفقد وتحديد زمن الاستعادة والبيانات الممكن فقدها.

## استضافات VPS مستقلة
- Hetzner Cloud يوفّر خوادم Cloud VPS ونسخًا احتياطية يومية اختيارية على مستوى قرص الخادم، وفق الوثائق الرسمية: https://docs.hetzner.com/cloud/servers/backups-snapshots/overview/ و https://docs.hetzner.com/cloud/servers/getting-started/enabling-backups/
- DigitalOcean Managed Databases for MySQL تتضمن نسخًا يومية وPoint-in-Time Recovery وفق الوثائق الرسمية: https://docs.digitalocean.com/products/databases/
- AWS Lightsail يدعم snapshots لقواعد البيانات والخوادم، ويمكن تفعيل snapshots تلقائية والاحتفاظ بما يصل إلى سبعة أيام وفق الوثائق الرسمية: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-configuring-automatic-snapshots.html

## ملاحظة ملكية واستقلال
امتلاك حساب مستقل لدى مزود سحابي يعني أن الحساب والفوترة والنسخ تحت سيطرة المستخدم، لكنه لا يلغي مخاطر فقدان كلمة المرور أو إغلاق الحساب أو حذف الموارد. يجب تفعيل MFA، وفصل النسخ الاحتياطية في حساب/تخزين مختلف، واختبار الاستعادة.
