# مصادر إعداد مراقبة Health Check

## UptimeRobot Telegram Integration
المصدر الرسمي: https://uptimerobot.com/integrations/telegram-integration/

- إضافة تكامل Telegram من Integrations & API ثم Add.
- اختيار الأحداث والهدف (محادثة شخصية أو مجموعة/قناة).
- للتنبيهات الشخصية: نسخ الرسالة التي يعرضها UptimeRobot وإرسالها إلى البوت ثم تفعيل الربط.
- للمجموعات: دعوة البوت إلى المجموعة واستخدام رسالة /start التي يوفرها UptimeRobot.
- الأحداث المتاحة تشمل Down وUp وانتهاء SSL/النطاق، ويمكن اختيار المناسب.

## UptimeRobot Telegram Blog
المصدر الرسمي: https://uptimerobot.com/blog/new-feature-telegram-integration/

الخطوات المذكورة: My Settings > Alert Contacts > New > Telegram، إنشاء جهة التنبيه، فتح رابط Telegram الفريد، الضغط على /start، ثم ربط جهة التنبيه بالمراقب.

## Telegram Bot API
المصدر الرسمي: https://core.telegram.org/bots/api

- طلبات Bot API تستخدم HTTPS بصيغة https://api.telegram.org/bot<TOKEN>/METHOD_NAME.
- الاستجابة JSON وتحتوي الحقل Boolean باسم ok، وقد تحتوي description وerror_code عند الفشل.
- لا حاجة إلى تنفيذ Bot API يدويًا عند استخدام تكامل UptimeRobot المباشر؛ يُستخدم فقط كبديل Webhook مخصص.

## ملاحظة خاصة بالمشروع
مسار التطبيق الصحيح هو /api/ping وليس /api_ping. نقطة الفحص الحالية المتوقعة: https://purepoint.onrender.com/api/ping، ويجب اعتبار الفحص ناجحًا عند HTTP 200 ووجود ok=true في JSON.
