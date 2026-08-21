# تحقق تكامل موقع العميل من واتساب

## نتيجة التحقق
توثيق Meta الرسمي يوضح أن WhatsApp Business Platform يدعم إرسال رسائل موقع، كما يدعم رسائل طلب الموقع التي تعرض زرًا للعميل لإرسال موقعه. هذا يتيح بناء تدفق رسمي يكون فيه العميل أو الموظف يرسل الموقع إلى رقم WhatsApp Business المرتبط بالتطبيق، ثم يستقبل الخادم الرسالة عبر Webhook ويستخرج الإحداثيات.

لا يوجد في التوثيق الذي تمت مراجعته ما يتيح للتطبيق قراءة رسائل حساب واتساب شخصي أو مراقبة صندوق محادثات واتساب العادي مباشرةً. لذلك لا ينبغي تنفيذ حل يعتمد على قراءة محادثات شخصية أو تجاوز صلاحيات واتساب.

## المصادر الرسمية
- Meta — Location messages: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/location-messages
- Meta — Location request messages: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/location-request-messages
- Meta — Send messages: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
- Meta — Permissions: https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/
- WhatsApp Business Platform: https://whatsappbusiness.com/products/business-platform-features/

## التوصية
الحل الأقل تعقيدًا حاليًا هو زر «لصق رابط الموقع من واتساب» مع تحليل روابط Google Maps، أو زر يفتح واتساب للمشاركة ثم يلصق المستخدم الرابط داخل التطبيق. التكامل الآلي الكامل يحتاج WhatsApp Business Platform، رقم Business، إعداد Webhook، صلاحيات Meta، ومتغيرات سرية، ولا يبدأ قبل تأكيد المستخدم امتلاك هذا النوع من الحساب.
