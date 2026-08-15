# متطلبات ربط واتساب الأعمال

توضح وثائق Meta الرسمية أن WhatsApp Cloud API يتيح إرسال الرسائل واستقبال webhooks. يلزم إنشاء تطبيق Meta مخصص لواتساب، ربطه بحساب WhatsApp Business، الاحتفاظ بمعرف رقم الهاتف التجاري ومعرف حساب الأعمال، وإنشاء رمز وصول دائم لحساب النظام بصلاحيات messaging وmanagement المناسبة.

لإرسال رسالة استباقية بعد مرور يوم على الموعد، ينبغي استخدام قالب رسالة معتمد من Meta. أما الردود الواردة فتصل عبر webhook لحقل messages، ويمكن ربط رد العميل بالعميل والموعد باستخدام رقم الهاتف ومعرف الرسالة أو معرّف خيار الرد. الرسائل التفاعلية تدعم خيارات يحددها العميل، وتظهر نتيجة الاختيار في webhook؛ لذلك يمكن توفير «أوافق على الزيارة» و«أطلب تغيير الموعد».

يجب أن يكون endpoint الـ webhook عامًا عبر HTTPS، يتحقق من طلب التحقق، ويقبل payloads ويعيد HTTP 200 بسرعة، مع منع تكرار معالجة الحدث لأن Meta قد تعيد إرسال webhook عند الفشل. لا يوجد موصل WhatsApp مفعّل في إعدادات الجلسة الحالية، ولذلك يلزم من المستخدم تجهيز بيانات Meta قبل تفعيل الإرسال الحقيقي.

## المراجع

1. Meta, WhatsApp Cloud API Get Started: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
2. Meta, Webhooks: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
3. Meta, Interactive list messages: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-list-messages
4. Meta, Template fundamentals: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
