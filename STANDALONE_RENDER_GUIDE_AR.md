# تشغيل نقطة نقاء بشكل مستقل

## قاعدة البيانات

المشروع يستخدم MySQL عبر Drizzle ORM و`mysql2`. الرابط العام:

```text
mysql://USER:PASSWORD@HOST:3306/DATABASE?ssl=%7B%22rejectUnauthorized%22%3Atrue%7D
```

يمكن أن يكون المضيف TiDB Cloud Serverless أو Aiven for MySQL أو أي خدمة MySQL-compatible. يجب إنشاء قاعدة البيانات أولًا، ثم وضع الرابط في `DATABASE_URL`. في TiDB انسخ رابط MySQL من Connect، وفي Aiven انسخ MySQL connection string مع تفعيل TLS إن كان مطلوبًا.

## المصادقة المستقلة

أزيل اعتماد تسجيل الدخول على Manus Auth. النظام الآن يستخدم JWT موقّعًا داخل Cookie آمنة، مع كلمات مرور مجزأة بواسطة `scrypt`. أول مستخدم يسجل من شاشة الدخول المحلية يصبح مديرًا، والمستخدمون اللاحقون يصبحون مستخدمين عاديين. يجب أن يكون `JWT_SECRET` عشوائيًا وطوله 32 حرفًا على الأقل، ولا يجوز وضعه في Git أو مشاركة قيمته.

## المتغيرات المطلوبة

```text
DATABASE_URL=رابط MySQL الكامل
JWT_SECRET=سر عشوائي لا يقل عن 32 حرفًا
NODE_ENV=production
PORT=يُضبط تلقائيًا بواسطة Render ولا حاجة لتثبيته يدويًا
```

يوجد قالب `standalone.env.template` بلا أسرار فعلية. لا تُستخدم متغيرات Manus OAuth لتسجيل الدخول في النسخة المستقلة. وظائف التخزين الخارجي أو الخرائط تحتاج إعدادًا منفصلًا إذا أردت استخدامها؛ لا تضع مفاتيحها في الواجهة الأمامية.

## الترحيلات

بعد ضبط `DATABASE_URL` محليًا شغّل:

```bash
pnpm install
pnpm run db:migrate
```

أمر `db:migrate` يطبق ملفات SQL الموجودة في `drizzle/migrations` فقط. أما `pnpm run db:push` فيولد ترحيلًا جديدًا ثم يطبقه، ويُستخدم أثناء تطوير المخطط وليس كأمر نشر متكرر. خذ نسخة احتياطية قبل أي ترحيل على قاعدة تحتوي بيانات فعلية.

## النشر على Render

ارفع المشروع إلى GitHub، ثم أنشئ Web Service جديدًا في Render واختر المستودع. استخدم الإعدادات التالية:

| الإعداد | القيمة |
|---|---|
| Runtime | Node |
| Build Command | `corepack enable && pnpm install --frozen-lockfile && pnpm run build` |
| Pre-Deploy Command | `pnpm run db:migrate` |
| Start Command | `pnpm start` |
| Health Check Path | `/` |

أضف في Environment متغيري `DATABASE_URL` و`JWT_SECRET`، واجعل `NODE_ENV=production`. يمكن استخدام ملف `render.yaml` المرفق لاستيراد هذه الإعدادات. بعد أول تشغيل افتح الموقع، اختر «إنشاء أول حساب مدير»، وسجّل الحساب الرئيسي.

## ملاحظات الاستقلال

التحويل الحالي يفصل المصادقة ومسار OAuth عن Manus، ويجعل تشغيل API وواجهة React على Render مستقلًا. لا تزال بعض الملفات الاختيارية الخاصة بالتخزين أو الخرائط موجودة للتوافق مع الميزات السابقة؛ إذا كانت هذه الميزات مطلوبة خارج Manus فيجب ربط S3-compatible storage وGoogle Maps بمفاتيحك أنت. لا تُحذف قاعدة البيانات أو المستخدمون عند إعادة نشر Render، لأن البيانات تبقى في مزود MySQL الخارجي.
