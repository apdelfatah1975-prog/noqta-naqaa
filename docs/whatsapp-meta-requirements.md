# متطلبات ربط WhatsApp Business الرسمي

## مصادر Meta الرسمية

1. https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
2. https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
3. https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in

## الخلاصة

يتطلب WhatsApp Cloud API إنشاء تطبيق Meta باستخدام حالة استخدام WhatsApp، وربطه بحساب WhatsApp Business، والحصول على WhatsApp Business Account ID وPhone Number ID. توضح Meta أن رمز الوصول المؤقت مناسب للاختبار، بينما يحتاج التشغيل المستمر إلى System User Access Token دائم مع الصلاحيات المناسبة.

رسائل التذكير خارج نافذة خدمة العملاء يجب أن تستخدم Message Template معتمدًا من Meta. قالب التذكير يجب أن يكون من فئة Utility، ويجب أن تكون حالته APPROVED قبل الإرسال. القوالب تدعم متغيرات مثل اسم العميل وتاريخ الموعد والفترة.

يشترط WhatsApp الحصول على موافقة مسبقة من العميل قبل مراسلته. يجب توضيح أن الموافقة تخص استقبال رسائل من الشركة، وذكر اسم الشركة، وتوفير طريقة واضحة لإلغاء الاشتراك واحترام طلب الإلغاء.

يجب إعداد Webhook اختياريًا لتلقي حالات التسليم والقراءة والفشل، وتسجيل نتيجة كل محاولة في التطبيق لمنع التكرار وإظهار الحالة للمسؤول.

## المتطلبات التي سيحتاجها التطبيق

- رقم واتساب الرسمي: 01008797774.
- Meta WhatsApp Business Account ID.
- Phone Number ID للرقم المرسل.
- Permanent System User Access Token، ويحفظ سرًا في إعدادات الخادم.
- اسم قالب رسالة عربي معتمد، مثل purepoint_service_reminder.
- لغة القالب ومحتواه والمتغيرات.
- حقل موافقة العميل على تلقي رسائل واتساب، مع تاريخ الموافقة وحالة الإلغاء.
- سجل لمحاولات الإرسال وMessage ID والحالة لمنع إرسال التذكير نفسه أكثر من مرة.

## قالب مقترح للمراجعة

الفئة: Utility

النص المقترح:
"مرحبًا {{1}}، معك نقطة نقاء. نذكّرك بأن موعد متابعة خدمة فلتر المياه الخاص بك هو {{2}} خلال {{3}}. للاتصال بنا أو إعادة جدولة الموعد، تواصل معنا على 01008797774. لإيقاف تذكيرات واتساب أرسل كلمة إلغاء."

المراجع:

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started "WhatsApp Cloud API Get Started"
[2]: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview "Template fundamentals"
[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in "Get opt-in for WhatsApp"
